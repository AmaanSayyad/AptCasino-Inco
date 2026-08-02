import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', streams: [] }, { status: 503 });

  const { data, error } = await db
    .from('streams')
    .select('id, playback_id, source, wallet, title, description, thumbnail_url, session_status, started_at, x_handle, telegram_username, discord_handle')
    .eq('is_approved', true)
    .order('session_status', { ascending: true })
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message, streams: [] }, { status: 400 });
  return NextResponse.json({ streams: data ?? [] });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { wallet, playbackId, source, title, description, thumbnailUrl, xHandle, telegramUsername, discordHandle, payoutWallet } = body || {};
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  if (!playbackId || !['youtube', 'hls', 'livepeer'].includes(source)) {
    return NextResponse.json({ error: 'playbackId and a valid source are required.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data, error } = await db
    .from('streams')
    .insert({
      playback_id: playbackId,
      source,
      wallet: normalizeWallet(wallet),
      title: title ?? null,
      description: description ?? null,
      thumbnail_url: thumbnailUrl ?? null,
      x_handle: xHandle ?? null,
      telegram_username: telegramUsername ?? null,
      discord_handle: discordHandle ?? null,
      payout_wallet: payoutWallet ?? null,
      is_approved: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, stream: data });
}
