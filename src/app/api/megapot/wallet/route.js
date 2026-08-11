import { NextResponse } from 'next/server';
import { amountToUsdc, fetchUnclaimedWins, fetchWalletStats, fetchWalletTickets } from '@/lib/megapot/dataApi';
import { isValidWalletAddress } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 });
  }

  try {
    const [stats, tickets, unclaimed] = await Promise.all([
      fetchWalletStats(wallet).catch(() => null),
      fetchWalletTickets(wallet, 10).catch(() => ({ data: [] })),
      fetchUnclaimedWins(wallet, 20).catch(() => ({ data: [] })),
    ]);

    return NextResponse.json({
      ok: true,
      stats: stats
        ? {
            totalTickets: stats.total_tickets,
            totalWins: stats.total_wins,
            totalWinningsUsdc: amountToUsdc(stats.total_winnings),
            totalSpentUsdc: amountToUsdc(stats.total_spent),
            referralEarningsUsdc: amountToUsdc(stats.total_referral_earnings),
            roundsPlayed: stats.rounds_played,
          }
        : null,
      tickets: tickets?.data || [],
      unclaimedWins: (unclaimed?.data || []).map((w) => ({
        ticketId: w.user_ticket_id,
        amountUsdc: amountToUsdc(w.amount || w.winnings_amount),
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unavailable',
      stats: null,
      tickets: [],
      unclaimedWins: [],
    });
  }
}
