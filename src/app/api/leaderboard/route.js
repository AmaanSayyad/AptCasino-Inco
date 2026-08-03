import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadBannedWalletKeys, filterBannedWalletRows } from '@/lib/bans/walletBan';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';

const RAW_TO_USDC = 10 ** USDC_DECIMALS;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const game = searchParams.get('game');
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', leaderboard: [] }, { status: 503 });

  let query = db.from('game_play_events').select('wallet, game, bet_raw, payout_raw, result').limit(2000);
  if (game && game !== 'all') query = query.eq('game', game);

  const [{ data, error }, banned] = await Promise.all([query, loadBannedWalletKeys()]);
  if (error) return NextResponse.json({ error: error.message, leaderboard: [] }, { status: 400 });

  const filtered = filterBannedWalletRows(data ?? [], banned, (r) => r.wallet);
  const byWallet = new Map();
  for (const row of filtered) {
    const entry = byWallet.get(row.wallet) ?? { wallet: row.wallet, wagered: 0, won: 0, bets: 0, biggestWin: 0 };
    const bet = Number(row.bet_raw || 0) / RAW_TO_USDC;
    const payout = Number(row.payout_raw || 0) / RAW_TO_USDC;
    entry.wagered += bet;
    entry.won += payout;
    entry.bets += 1;
    entry.biggestWin = Math.max(entry.biggestWin, payout);
    byWallet.set(row.wallet, entry);
  }

  const leaderboard = [...byWallet.values()]
    .sort((a, b) => b.wagered - a.wagered)
    .slice(0, limit)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return NextResponse.json({ leaderboard });
}
