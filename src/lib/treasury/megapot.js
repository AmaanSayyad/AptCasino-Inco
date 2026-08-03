import { createPublicClient, createWalletClient, http, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS } from '@/lib/baseSepolia';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';

const CREDITS_PER_TICKET = 1000;

/**
 * Mirrors AptCasino.sol's _award() formula exactly. On-chain, custodial rounds credit
 * the treasury's own address (msg.sender of the underlying game call) — this off-chain
 * ledger is what lets a real house-balance player still earn and later claim their own
 * ticket, via MegapotRewardVault.claimTicketFor, which spends the treasury's pooled
 * on-chain balance but mints the ticket straight into the real player's wallet.
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

/**
 * Spends 1000 credits from the caller's off-chain ledger, then has the treasury claim a
 * real ticket out of ITS OWN pooled on-chain credits (claimTicketFor), minted directly
 * to `wallet`. Rolls the off-chain debit back if the on-chain call fails so credits
 * can't be silently lost.
 */
export async function claimMegapotTicketFor(db, wallet) {
  const { data: afterDebit, error: debitError } = await db.rpc('treasury_megapot_debit', { p_wallet: wallet, p_amount: CREDITS_PER_TICKET });
  if (debitError) throw new Error(debitError.message);
  if (afterDebit === null) throw new Error('Not enough Megapot credits yet — need 1000.');

  try {
    const wallet_ = walletClient();
    const hash = await wallet_.writeContract({ address: rewardVaultAddress, abi: rewardVaultAbi, functionName: 'claimTicketFor', args: [wallet] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const [claimed] = parseEventLogs({ abi: rewardVaultAbi, eventName: 'TicketClaimed', logs: receipt.logs });
    if (!claimed) throw new Error('TicketClaimed event was not found');
    return { hash, ticketId: claimed.args.ticketId, creditsRemaining: afterDebit };
  } catch (claimError) {
    await db.rpc('treasury_megapot_award', { p_wallet: wallet, p_amount: CREDITS_PER_TICKET });
    throw claimError;
  }
}
