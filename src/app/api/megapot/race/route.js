import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** AptCasino-sourced Megapot ticket race (claims logged at mint time). */
export async function GET(request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const url = new URL(request.url);
  const hours = Math.min(168, Math.max(1, Number(url.searchParams.get('hours') || 24)));
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data, error } = await db
    .from('megapot_ticket_claims')
    .select('wallet, ticket_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    // Table may not exist yet before migration is applied.
    return NextResponse.json({ ok: true, hours, leaderboard: [], recent: [], note: error.message });
  }

  const counts = new Map();
  for (const row of data || []) {
    const w = row.wallet;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const leaderboard = [...counts.entries()]
    .map(([wallet, tickets]) => ({ wallet, tickets }))
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, 25);

  return NextResponse.json({
    ok: true,
    hours,
    leaderboard,
    recent: (data || []).slice(0, 20),
    totalTickets: data?.length || 0,
  });
}
