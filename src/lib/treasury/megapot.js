import { createPublicClient, createWalletClient, http, parseEventLogs, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS } from '@/lib/baseSepolia';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';
import { normalizeWallet } from '@/lib/supabase/admin';

const CREDITS_PER_TICKET = 1000;

/**
 * Mirrors AptCasino.sol's _award() formula exactly.
 */
export function megapotCreditsForRound(wagerRaw, payoutRaw) {
  let amount = Math.floor(Number(wagerRaw) / 1e4);
  if (amount < 10) amount = 10;
  if (amount > 250) amount = 250;
  if (Number(payoutRaw) > Number(wagerRaw)) amount += 50;
  return amount;
}

export async function awardMegapotCredits(db, wallet, wagerRaw, payoutRaw) {
  const amount = megapotCreditsForRound(wagerRaw, payoutRaw);
  const { data, error } = await db.rpc('treasury_megapot_award', { p_wallet: wallet, p_amount: amount });
  if (error) throw new Error(error.message);
  return { amount, credits: data };
}

const transport = http(BASE_SEPOLIA_RPC_URLS[0], { retryCount: 2, timeout: 20_000 });
const publicClient = createPublicClient({ chain: APTCASINO_CHAIN, transport });
function walletClient() {
  return createWalletClient({ account: privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY), chain: APTCASINO_CHAIN, transport });
}

/** Resolve AptCasino invite wallet for Megapot secondary referrer (if any). */
export async function resolveInviterWallet(db, playerWallet) {
  if (!db || !playerWallet) return zeroAddress;
  const { data } = await db
    .from('referrals')
    .select('referrer_wallet')
    .eq('referee_wallet', normalizeWallet(playerWallet))
    .maybeSingle();
  if (!data?.referrer_wallet) return zeroAddress;
  return data.referrer_wallet;
}

/**
 * Spends 1000 credits from the caller's off-chain ledger, then has the treasury claim a
 * real ticket via claimTicketFor(player, inviter) so platform + inviter referrers are set.
 */
export async function claimMegapotTicketFor(db, wallet) {
  const { data: afterDebit, error: debitError } = await db.rpc('treasury_megapot_debit', { p_wallet: wallet, p_amount: CREDITS_PER_TICKET });
  if (debitError) throw new Error(debitError.message);
  if (afterDebit === null) throw new Error('Not enough Megapot credits yet — need 1000.');

  try {
    const inviter = await resolveInviterWallet(db, wallet);
    const wallet_ = walletClient();
    const hash = await wallet_.writeContract({
      address: rewardVaultAddress,
      abi: rewardVaultAbi,
      functionName: 'claimTicketFor',
      args: [wallet, inviter],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    const [claimed] = parseEventLogs({ abi: rewardVaultAbi, eventName: 'TicketClaimed', logs: receipt.logs });
    if (!claimed) throw new Error('TicketClaimed event was not found');

    // Race board + claim history (best-effort).
    await db.from('megapot_ticket_claims').insert({
      wallet: normalizeWallet(wallet),
      ticket_id: claimed.args.ticketId.toString(),
      tx_hash: hash,
      inviter_wallet: inviter === zeroAddress ? null : normalizeWallet(inviter),
      source: 'treasury',
    }).catch(() => {});

    return { hash, ticketId: claimed.args.ticketId, creditsRemaining: afterDebit, inviter };
  } catch (claimError) {
    await db.rpc('treasury_megapot_award', { p_wallet: wallet, p_amount: CREDITS_PER_TICKET });
    throw claimError;
  }
}
