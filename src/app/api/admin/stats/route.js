import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: walletCount },
    { data: events },
    { count: liveStreamCount },
    { count: openTournamentCount },
    { data: sessions },
  ] = await Promise.all([
    db.from('tracked_wallets').select('wallet', { count: 'exact', head: true }),
    db.from('game_play_events').select('bet_raw, payout_raw'),
    db.from('streams').select('id', { count: 'exact', head: true }).eq('session_status', 'live'),
    db.from('tournaments').select('id', { count: 'exact', head: true }).in('status', ['open', 'live']),
    db
      .from('user_sessions')
      .select('started_at, last_ping_at')
      .gte('started_at', sevenDaysAgo)
      .limit(2000),
  ]);

  const totals = (events ?? []).reduce(
    (acc, e) => ({ wagered: acc.wagered + Number(e.bet_raw || 0), paidOut: acc.paidOut + Number(e.payout_raw || 0) }),
    { wagered: 0, paidOut: 0 },
  );

  const dwellSeconds = (sessions ?? []).map(
    (s) => (new Date(s.last_ping_at).getTime() - new Date(s.started_at).getTime()) / 1000,
  );
  const avgSessionSeconds = dwellSeconds.length
    ? Math.round(dwellSeconds.reduce((a, b) => a + b, 0) / dwellSeconds.length)
    : 0;

  return NextResponse.json({
    wallets: walletCount ?? 0,
    totalGames: events?.length ?? 0,
    totalWagered: totals.wagered,
    totalPaidOut: totals.paidOut,
    liveStreams: liveStreamCount ?? 0,
    openTournaments: openTournamentCount ?? 0,
    avgSessionSeconds,
  });
}
