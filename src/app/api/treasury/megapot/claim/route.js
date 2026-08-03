import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { claimMegapotTicketFor } from '@/lib/treasury/megapot';
import { treasuryAddress } from '@/lib/treasury/signer';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  try {
    const result = await claimMegapotTicketFor(db, wallet);
    return NextResponse.json({ ok: true, ticketId: result.ticketId.toString(), hash: result.hash });
  } catch (claimError) {
    return NextResponse.json({ error: claimError instanceof Error ? claimError.message : 'Claim failed.' }, { status: 502 });
  }
}
