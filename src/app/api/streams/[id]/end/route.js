import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  const { id } = await params;
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const now = new Date();
  const { data, error } = await db
    .from('streams')
    .update({
      session_status: 'ended',
      ended_at: now.toISOString(),
      reward_status: 'pending',
      reward_unlock_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id)
    .select('duration_seconds, reward_tier_pct')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, ...data });
}
