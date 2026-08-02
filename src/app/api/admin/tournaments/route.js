import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', tournaments: [] }, { status: 503 });

  const { data, error } = await db.from('tournaments').select('*').order('starts_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message, tournaments: [] }, { status: 400 });
  return NextResponse.json({ tournaments: data ?? [] });
}

export async function POST(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const body = await request.json().catch(() => ({}));
  const { name, game, prizePool, entryFee, maxParticipants, startsAt, endsAt, competitionMode, notes } = body;
  if (!name || !game || !startsAt) {
    return NextResponse.json({ error: 'name, game, and startsAt are required.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data, error } = await db
    .from('tournaments')
    .insert({
      name,
      game,
      prize_pool: prizePool ?? 0,
      entry_fee: entryFee ?? 0,
      max_participants: maxParticipants ?? 100,
      starts_at: startsAt,
      ends_at: endsAt ?? null,
      competition_mode: competitionMode ?? 'volume',
      notes: notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, tournament: data });
}
