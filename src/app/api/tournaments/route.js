import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', tournaments: [] }, { status: 503 });

  const { data, error } = await db
    .from('tournaments')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message, tournaments: [] }, { status: 400 });
  return NextResponse.json({ tournaments: data ?? [] });
}
