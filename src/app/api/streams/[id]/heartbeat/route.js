import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  const { id } = await params;
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: stream } = await db.from('streams').select('started_at, session_status').eq('id', id).maybeSingle();
  if (!stream || stream.session_status !== 'live') {
    return NextResponse.json({ error: 'Stream not live' }, { status: 404 });
  }

  const now = new Date();
  const durationSeconds = Math.max(0, Math.floor((now.getTime() - new Date(stream.started_at).getTime()) / 1000));
  const rewardTierPct = durationSeconds >= 1800 ? 0.3 : durationSeconds >= 900 ? 0.2 : durationSeconds >= 300 ? 0.1 : 0;

  const { error } = await db
    .from('streams')
    .update({ last_heartbeat_at: now.toISOString(), duration_seconds: durationSeconds, reward_tier_pct: rewardTierPct })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, durationSeconds, rewardTierPct });
}
