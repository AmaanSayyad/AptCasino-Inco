import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', users: [] }, { status: 503 });

  const [{ data: wallets }, { data: events }, { data: statuses }] = await Promise.all([
    db.from('tracked_wallets').select('wallet, first_seen_at, last_seen_at'),
    db.from('game_play_events').select('wallet, bet_raw, payout_raw'),
    db.from('wallet_account_status').select('wallet, status'),
  ]);

  const statusByWallet = new Map((statuses ?? []).map((s) => [s.wallet, s.status]));
  const activity = new Map();
  for (const e of events ?? []) {
    const entry = activity.get(e.wallet) ?? { bets: 0, wagered: 0, won: 0 };
    entry.bets += 1;
    entry.wagered += Number(e.bet_raw || 0);
    entry.won += Number(e.payout_raw || 0);
    activity.set(e.wallet, entry);
  }

  const users = (wallets ?? []).map((w) => ({
    wallet: w.wallet,
    firstSeenAt: w.first_seen_at,
    lastSeenAt: w.last_seen_at,
    status: statusByWallet.get(w.wallet) ?? 'active',
    ...(activity.get(w.wallet) ?? { bets: 0, wagered: 0, won: 0 }),
  }));

  return NextResponse.json({ users });
}
