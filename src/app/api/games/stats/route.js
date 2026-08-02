import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const GAMES = ['plinko', 'mines', 'roulette', 'wheel'];

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', stats: [] }, { status: 503 });

  const { data, error } = await db.from('game_play_events').select('game, bet_raw, payout_raw').limit(5000);
  if (error) return NextResponse.json({ error: error.message, stats: [] }, { status: 400 });

  const byGame = new Map(GAMES.map((g) => [g, { game: g, bets: 0, wagered: 0, paidOut: 0 }]));
  for (const row of data ?? []) {
    const entry = byGame.get(row.game);
    if (!entry) continue;
    entry.bets += 1;
    entry.wagered += Number(row.bet_raw || 0);
    entry.paidOut += Number(row.payout_raw || 0);
  }
  return NextResponse.json({ stats: [...byGame.values()] });
}
