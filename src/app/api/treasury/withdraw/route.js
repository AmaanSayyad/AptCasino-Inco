import { NextResponse } from 'next/server';
import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { sendUsdc, treasuryAddress } from '@/lib/treasury/signer';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const amountRaw = Number(body?.amountRaw);
  if (!Number.isInteger(amountRaw) || amountRaw <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: newBalance, error: debitError } = await db.rpc('treasury_debit', { p_wallet: normalizeWallet(wallet), p_amount: amountRaw });
  if (debitError) return NextResponse.json({ error: debitError.message }, { status: 400 });
  if (newBalance === null) return NextResponse.json({ error: 'Insufficient treasury balance' }, { status: 400 });

  let txHash;
  try {
    txHash = await sendUsdc(wallet, BigInt(amountRaw));
  } catch (sendError) {
    // Refund the ledger debit — the on-chain send never went through.
    await db.rpc('treasury_credit', { p_wallet: normalizeWallet(wallet), p_amount: amountRaw });
    return NextResponse.json({ error: sendError instanceof Error ? sendError.message : 'Withdrawal transfer failed' }, { status: 502 });
  }

  await db.from('treasury_ledger').insert({ wallet: normalizeWallet(wallet), kind: 'withdraw', amount_raw: amountRaw, tx_hash: txHash });
  return NextResponse.json({ ok: true, balanceRaw: newBalance, txHash });
}
