import { verifyMessage } from 'viem';
import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';

/** Message a client must sign for a given wallet-mutating action. Keep in sync with the frontend. */
export function walletAuthMessage(address, purpose) {
  return `AptCasino ${purpose} for ${address.toLowerCase()}`;
}

/**
 * Verifies an EIP-191 personal_sign signature and consumes it (one-time use) via
 * wallet_auth_consumed. Returns null on success, or an error string on failure.
 */
export async function verifyAndConsumeWalletSignature({ address, purpose, signature }) {
  if (!address || !signature) return 'Missing wallet signature.';

  const message = walletAuthMessage(address, purpose);
  const valid = await verifyMessage({ address, message, signature }).catch(() => false);
  if (!valid) return 'Invalid wallet signature.';

  const db = getSupabaseAdmin();
  if (!db) return 'Supabase is not configured on the server.';

  const { error } = await db.from('wallet_auth_consumed').insert({
    signature_hash: signature,
    wallet: normalizeWallet(address),
    purpose,
  });
  if (error) {
    if (error.code === '23505') return 'This signature was already used.';
    return `Signature check failed: ${error.message}`;
  }
  return null;
}
