import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword, verifyPassword } from '@/lib/server/password';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { slug } = await params;
  const { currentPassword, newPassword } = await request.json().catch(() => ({}));
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: allocation } = await db.from('kol_allocations').select('portal_password_hash').eq('kol_slug', slug).maybeSingle();
  if (!allocation || !verifyPassword(currentPassword, allocation.portal_password_hash)) {
    return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
  }

  const { error } = await db
    .from('kol_allocations')
    .update({ portal_password_hash: hashPassword(newPassword), portal_password_plain: newPassword, updated_at: new Date().toISOString() })
    .eq('kol_slug', slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
