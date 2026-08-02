import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';
import { hashPassword } from '@/lib/server/password';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', allocations: [] }, { status: 503 });

  const { data, error } = await db.from('kol_allocations').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message, allocations: [] }, { status: 400 });
  return NextResponse.json({ allocations: data ?? [] });
}

export async function POST(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const body = await request.json().catch(() => ({}));
  const { kolSlug, displayName, walletAddress, portalPassword, lockDays, cliffDays, amountAptc, pctOfSupply } = body;
  if (!kolSlug || !displayName || !walletAddress || !portalPassword) {
    return NextResponse.json({ error: 'kolSlug, displayName, walletAddress, and portalPassword are required.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const days = lockDays ?? 14;
  const unlockAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('kol_allocations')
    .insert({
      kol_slug: kolSlug,
      display_name: displayName,
      wallet_address: walletAddress,
      amount_aptc: amountAptc ?? 1000000,
      pct_of_supply: pctOfSupply ?? 0.1,
      lock_days: days,
      cliff_days: cliffDays ?? days,
      unlock_at: unlockAt,
      portal_password_hash: hashPassword(portalPassword),
      portal_password_plain: portalPassword,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { portal_password_hash, ...safe } = data;
  return NextResponse.json({ ok: true, allocation: safe });
}
