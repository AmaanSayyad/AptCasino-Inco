import { NextResponse } from 'next/server';
import { parseEventLogs, parseAbi } from 'viem';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';
import { publicClient, treasuryAddress } from '@/lib/treasury/signer';
import { usdcAddress } from '@/lib/contracts/usdc';

export const dynamic = 'force-dynamic';

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);

/**
 * Credits a user's treasury balance after they send USDC directly to the treasury
 * wallet. The amount/sender are read back from the actual on-chain Transfer event
 * (not trusted from the request body) so a client can't claim a bigger deposit than
 * it really sent.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { wallet, txHash } = body || {};
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  if (!TX_HASH_RE.test(txHash || '')) return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });

  const treasury = treasuryAddress();
  if (!treasury) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return NextResponse.json({ error: 'Deposit transaction not found' }, { status: 404 });
  }
  if (receipt.status !== 'success') return NextResponse.json({ error: 'Deposit transaction did not succeed' }, { status: 400 });

  const [transfer] = parseEventLogs({ abi: transferAbi, logs: receipt.logs }).filter(
    (log) => log.address.toLowerCase() === usdcAddress.toLowerCase() && log.args.to.toLowerCase() === treasury.toLowerCase(),
  );
  if (!transfer) return NextResponse.json({ error: 'No USDC transfer to the treasury address found in that transaction' }, { status: 400 });
  if (transfer.args.from.toLowerCase() !== normalizeWallet(wallet)) {
    return NextResponse.json({ error: 'Transfer sender does not match the given wallet' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const amountRaw = Number(transfer.args.value);
  const { error: ledgerError } = await db.from('treasury_ledger').insert({
    wallet: normalizeWallet(wallet), kind: 'deposit', amount_raw: amountRaw, tx_hash: txHash,
  });
  if (ledgerError) {
    if (ledgerError.code === '23505') {
      const { data } = await db.from('treasury_balances').select('balance_raw').eq('wallet', normalizeWallet(wallet)).maybeSingle();
      return NextResponse.json({ ok: true, alreadyCredited: true, balanceRaw: data?.balance_raw ?? 0 });
    }
    return NextResponse.json({ error: ledgerError.message }, { status: 400 });
  }

  const { data: newBalance, error: creditError } = await db.rpc('treasury_credit', { p_wallet: normalizeWallet(wallet), p_amount: amountRaw });
  if (creditError) return NextResponse.json({ error: creditError.message }, { status: 400 });
  return NextResponse.json({ ok: true, balanceRaw: newBalance });
}
