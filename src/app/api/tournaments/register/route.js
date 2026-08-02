import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { wallet, tournamentId, entryFeeTxHash, entryFeeAmount } = await request.json().catch(() => ({}));
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  if (!tournamentId) return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: tournament } = await db.from('tournaments').select('status, max_participants').eq('id', tournamentId).maybeSingle();
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (!['open', 'upcoming'].includes(tournament.status)) {
    return NextResponse.json({ error: 'Registration is closed for this tournament.' }, { status: 400 });
  }

  const { data, error } = await db
    .from('tournament_registrations')
    .insert({
      tournament_id: tournamentId,
      wallet: normalizeWallet(wallet),
      entry_fee_tx_hash: entryFeeTxHash ?? null,
      entry_fee_amount: entryFeeAmount ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already registered for this tournament.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, registration: data });
}
