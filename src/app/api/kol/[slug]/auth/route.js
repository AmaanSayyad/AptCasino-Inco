import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/server/password';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { slug } = await params;
  const { password } = await request.json().catch(() => ({}));
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: allocation } = await db.from('kol_allocations').select('*').eq('kol_slug', slug).maybeSingle();
  if (!allocation || !verifyPassword(password, allocation.portal_password_hash)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const { portal_password_hash, portal_password_plain, ...safeAllocation } = allocation;
  return NextResponse.json({ ok: true, allocation: safeAllocation });
}
