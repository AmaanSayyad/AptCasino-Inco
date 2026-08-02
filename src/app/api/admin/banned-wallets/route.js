import { NextResponse } from 'next/server';
import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', banned: [] }, { status: 503 });

  const { data, error } = await db.from('banned_wallets').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message, banned: [] }, { status: 400 });
  return NextResponse.json({ banned: data ?? [] });
}

export async function POST(request) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const { wallet, reason } = await request.json().catch(() => ({}));
  if (!wallet) return NextResponse.json({ error: 'wallet is required' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { error } = await db
    .from('banned_wallets')
    .upsert({ wallet_address: normalizeWallet(wallet), reason: reason ?? null }, { onConflict: 'wallet_address' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
