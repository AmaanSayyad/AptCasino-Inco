import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';
import { verifyAndConsumeWalletSignature } from '@/lib/server/walletAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const key = normalizeWallet(wallet);
  const { data: profile } = await db.from('user_profiles').select('*').eq('wallet', key).maybeSingle();
  const { data: tracked } = await db.from('tracked_wallets').select('first_seen_at, last_seen_at').eq('wallet', key).maybeSingle();

  return NextResponse.json({
    wallet: key,
    handle: profile?.handle ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    twitterHandle: profile?.twitter_handle ?? null,
    memberSince: tracked?.first_seen_at ?? profile?.created_at ?? null,
  });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => null);
  const { wallet, handle, avatarUrl, bio, twitterHandle, signature } = body || {};
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const authError = await verifyAndConsumeWalletSignature({ address: wallet, purpose: 'update profile', signature });
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const key = normalizeWallet(wallet);
  const { data, error } = await db
    .from('user_profiles')
    .upsert(
      {
        wallet: key,
        handle: handle ?? null,
        avatar_url: avatarUrl ?? null,
        bio: bio ?? null,
        twitter_handle: twitterHandle ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'wallet' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, profile: data });
}
