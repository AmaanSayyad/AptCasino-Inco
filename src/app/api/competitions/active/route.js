import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', competitions: [] }, { status: 503 });

  const { data: tournaments, error } = await db
    .from('tournaments')
    .select('*')
    .in('status', ['open', 'live', 'upcoming'])
    .order('starts_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message, competitions: [] }, { status: 400 });

  const ids = (tournaments ?? []).map((t) => t.id);
  const { data: registrations } = ids.length
    ? await db.from('tournament_registrations').select('tournament_id').in('tournament_id', ids)
    : { data: [] };

  const counts = new Map();
  for (const row of registrations ?? []) counts.set(row.tournament_id, (counts.get(row.tournament_id) ?? 0) + 1);

  const competitions = (tournaments ?? []).map((t) => ({ ...t, participantCount: counts.get(t.id) ?? 0 }));
  return NextResponse.json({ competitions });
}
