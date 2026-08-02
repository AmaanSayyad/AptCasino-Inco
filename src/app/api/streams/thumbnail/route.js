import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const streamId = form?.get('streamId');
  const file = form?.get('file');
  if (!streamId || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'streamId and file are required.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be jpeg/png/webp/gif under 2MB.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const ext = file.type.split('/')[1] || 'jpg';
  const path = `${streamId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await db.storage
    .from('stream-thumbnails')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = db.storage.from('stream-thumbnails').getPublicUrl(path);
  const { error: updateError } = await db.from('streams').update({ thumbnail_url: publicUrl.publicUrl }).eq('id', streamId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, thumbnailUrl: publicUrl.publicUrl });
}
