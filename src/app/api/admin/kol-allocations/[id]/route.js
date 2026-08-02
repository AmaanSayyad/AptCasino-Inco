import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';
import { hashPassword } from '@/lib/server/password';

export const dynamic = 'force-dynamic';

const PATCHABLE = [
  'display_name', 'status', 'admin_notes', 'x_handle', 'country', 'telegram',
  'avg_post_views', 'promotion_condition', 'brought_by', 'brought_on',
  'fulfillment_tx_hash', 'fulfilled_at',
];

export async function PATCH(request, { params }) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => PATCHABLE.includes(key)));
  if (body.resetPassword) {
    patch.portal_password_hash = hashPassword(body.resetPassword);
    patch.portal_password_plain = body.resetPassword;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data, error } = await db.from('kol_allocations').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { portal_password_hash, ...safe } = data;
  return NextResponse.json({ ok: true, allocation: safe });
}
