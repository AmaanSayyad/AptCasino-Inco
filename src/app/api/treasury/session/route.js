import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';
import { verifyAndConsumeWalletSignature } from '@/lib/server/walletAuth';
import { sessionTtlMs } from '@/lib/treasury/session';

export const dynamic = 'force-dynamic';

/**
 * One wallet signature (over a client-generated nonce, so it's unique and safe to
 * one-time-consume) issues a 24h session token. Every subsequent treasury play/withdraw
 * call just presents this token — no further wallet signature needed per round.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { wallet, nonce, signature } = body || {};
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  if (!nonce || typeof nonce !== 'string' || nonce.length > 64) return NextResponse.json({ error: 'Missing nonce' }, { status: 400 });

  const authError = await verifyAndConsumeWalletSignature({ address: wallet, purpose: `treasury-session-${nonce}`, signature });
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const expiresAt = new Date(Date.now() + sessionTtlMs()).toISOString();
  const { data, error } = await db
    .from('treasury_sessions')
    .insert({ wallet: normalizeWallet(wallet), expires_at: expiresAt })
    .select('token, expires_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ token: data.token, expiresAt: data.expires_at });
}
