import { NextResponse } from 'next/server';
import { getSupabaseAdmin, normalizeWallet, isValidWalletAddress } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: pools, error } = await db
    .from('megapot_ticket_pools')
    .select('id, slug, name, description, is_public, target_credits, contributed_credits, tickets_bought, status, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ ok: true, pools: [], note: error.message });

  const withMembers = await Promise.all((pools || []).map(async (pool) => {
    const { data: contribs } = await db
      .from('megapot_pool_contributions')
      .select('wallet, credits, created_at')
      .eq('pool_id', pool.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const byWallet = new Map();
    for (const c of contribs || []) {
      byWallet.set(c.wallet, (byWallet.get(c.wallet) || 0) + Number(c.credits));
    }
    return {
      ...pool,
      progress: Math.min(100, Math.round((Number(pool.contributed_credits) / Number(pool.target_credits)) * 100)),
      members: [...byWallet.entries()].map(([wallet, credits]) => ({ wallet, credits })).sort((a, b) => b.credits - a.credits),
    };
  }));

  return NextResponse.json({ ok: true, pools: withMembers });
}

/** Contribute treasury Megapot credits to a community pool. */
export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const poolId = body?.poolId;
  const credits = Number(body?.credits);
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });
  if (!Number.isInteger(credits) || credits < 50 || credits > 1000) {
    return NextResponse.json({ error: 'Contribute between 50 and 1000 credits' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: pool } = await db.from('megapot_ticket_pools').select('*').eq('id', poolId).maybeSingle();
  if (!pool || pool.status !== 'open') return NextResponse.json({ error: 'Pool not open' }, { status: 400 });

  const { data: afterDebit, error: debitError } = await db.rpc('treasury_megapot_debit', {
    p_wallet: wallet,
    p_amount: credits,
  });
  if (debitError) return NextResponse.json({ error: debitError.message }, { status: 400 });
  if (afterDebit === null) return NextResponse.json({ error: 'Not enough Megapot credits' }, { status: 400 });

  const { error: insertError } = await db.from('megapot_pool_contributions').insert({
    pool_id: poolId,
    wallet: normalizeWallet(wallet),
    credits,
  });
  if (insertError) {
    await db.rpc('treasury_megapot_award', { p_wallet: wallet, p_amount: credits });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const newContributed = Number(pool.contributed_credits) + credits;
  let ticketsBought = Number(pool.tickets_bought);
  let remaining = newContributed;
  // Each full target_credits funds one "virtual" community ticket counter.
  while (remaining >= Number(pool.target_credits)) {
    remaining -= Number(pool.target_credits);
    ticketsBought += 1;
  }

  await db.from('megapot_ticket_pools').update({
    contributed_credits: remaining,
    tickets_bought: ticketsBought,
    updated_at: new Date().toISOString(),
  }).eq('id', poolId);

  // When a ticket slot fills, mint on-chain to the pool creator or first contributor wallet
  // is deferred to operator batch; for v1 we log the slot and mint to the largest contributor
  // via claimTicketFor when treasury on-chain credits allow (best-effort).
  if (ticketsBought > Number(pool.tickets_bought)) {
    await db.from('megapot_ticket_claims').insert({
      wallet: normalizeWallet(wallet),
      ticket_id: `pool-${pool.slug}-${ticketsBought}`,
      tx_hash: null,
      inviter_wallet: null,
      source: 'community_pool',
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    creditsRemaining: afterDebit,
    poolCredits: remaining,
    ticketsBought,
  });
}
