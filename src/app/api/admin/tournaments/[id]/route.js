import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireDashboardAdmin } from '@/lib/admin/requireDashboardAdmin';

export const dynamic = 'force-dynamic';

const PATCHABLE = ['name', 'status', 'prize_pool', 'entry_fee', 'max_participants', 'starts_at', 'ends_at', 'notes', 'rewards_distributed_at'];

export async function PATCH(request, { params }) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => PATCHABLE.includes(key)));
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data, error } = await db.from('tournaments').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, tournament: data });
}

export async function DELETE(request, { params }) {
  const deny = requireDashboardAdmin(request);
  if (deny) return deny;

  const { id } = await params;
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { error } = await db.from('tournaments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
