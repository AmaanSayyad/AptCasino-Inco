import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data } = await db.from('treasury_balances').select('balance_raw').eq('wallet', normalizeWallet(wallet)).maybeSingle();
  return NextResponse.json({ balanceRaw: data?.balance_raw ?? 0 });
}
