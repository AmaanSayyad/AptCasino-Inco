import { createClient } from '@supabase/supabase-js';

let cached = null;

/** Server-only client using the service role key (bypasses RLS). Never import from client code. */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidWalletAddress(address) {
  return typeof address === 'string' && EVM_ADDRESS_RE.test(address);
}

export function normalizeWallet(address) {
  return typeof address === 'string' ? address.toLowerCase() : address;
}
