import { NextResponse } from 'next/server';
import {
  amountToUsdc,
  fetchActiveRound,
  fetchLatestSettledRound,
  fetchRoundPlayers,
  fetchRoundWins,
} from '@/lib/megapot/dataApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const active = await fetchActiveRound().catch(() => null);
    let latestSettled = null;
    try {
      latestSettled = await fetchLatestSettledRound();
    } catch {
      latestSettled = null;
    }

    const roundId = active?.id || latestSettled?.id;
    let players = [];
    let wins = [];
    if (roundId) {
      const [p, w] = await Promise.all([
        fetchRoundPlayers(roundId, 15).catch(() => ({ data: [] })),
        fetchRoundWins(roundId, 10).catch(() => ({ data: [] })),
      ]);
      players = p?.data || [];
      wins = w?.data || [];
    }

    return NextResponse.json({
      ok: true,
      active: active
        ? {
            id: active.id,
            status: active.status,
            prizePoolUsdc: amountToUsdc(active.prize_pool),
            ticketCount: active.ticket_count,
            uniqueParticipants: active.unique_participants,
            endedAt: active.ended_at,
            prizeTiers: (active.prize_tiers || [])
              .filter((t) => t.payout?.amount && t.payout.amount !== '0')
              .map((t) => ({
                tierId: t.tier_id,
                normals: t.normal_matches,
                bonus: t.bonusball_match,
                payoutUsdc: amountToUsdc(t.payout),
                ticketCount: t.ticket_count,
              })),
          }
        : null,
      latestSettled: latestSettled
        ? {
            id: latestSettled.id,
            winningNumbers: latestSettled.winning_numbers,
            prizePoolUsdc: amountToUsdc(latestSettled.prize_pool),
            ticketCount: latestSettled.ticket_count,
            winnersCount: latestSettled.winners_count,
          }
        : null,
      players: players.map((p) => ({
        wallet: p.wallet,
        tickets: p.total_ticket_count,
        wins: p.winning_ticket_count,
        payoutUsdc: amountToUsdc(p.total_payout),
      })),
      wins: wins.map((w) => ({
        wallet: w.wallet,
        amountUsdc: amountToUsdc(w.amount || w.winnings_amount),
        ticketId: w.user_ticket_id,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Megapot data unavailable',
      active: null,
      players: [],
      wins: [],
    });
  }
}
