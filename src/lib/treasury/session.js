import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function sessionTtlMs() {
  return SESSION_TTL_MS;
}

/** Resolves the wallet behind a treasury session bearer token, or null if invalid/expired. */
export async function resolveTreasurySession(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db.from('treasury_sessions').select('wallet, expires_at').eq('token', token).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return normalizeWallet(data.wallet);
}
