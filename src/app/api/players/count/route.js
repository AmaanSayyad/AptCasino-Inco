import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', count: 0 }, { status: 503 });

  const { count, error } = await db.from('tracked_wallets').select('wallet', { count: 'exact', head: true });
  if (error) return NextResponse.json({ error: error.message, count: 0 }, { status: 400 });
  return NextResponse.json({ count: count ?? 0 });
}
