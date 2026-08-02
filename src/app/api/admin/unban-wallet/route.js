import { NextResponse } from 'next/server';
import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const { wallet } = await request.json().catch(() => ({}));
  if (!wallet) return NextResponse.json({ error: 'wallet is required' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { error } = await db.from('banned_wallets').delete().eq('wallet_address', normalizeWallet(wallet));
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
