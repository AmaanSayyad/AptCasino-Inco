import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';

export function isBannedViaEnv(address) {
  const raw = process.env.BANNED_WALLET_ADDRESSES || '';
  if (!raw.trim()) return false;
  const key = normalizeWallet(address);
  return raw.split(',').map((s) => normalizeWallet(s.trim())).filter(Boolean).includes(key);
}

export function bannedKeysFromEnv() {
  const keys = new Set();
  const raw = process.env.BANNED_WALLET_ADDRESSES || '';
  for (const part of raw.split(',')) {
    const key = normalizeWallet(part.trim());
    if (key) keys.add(key);
  }
  return keys;
}

/** All globally banned wallet keys (env + DB). Used to filter public leaderboards/history. */
export async function loadBannedWalletKeys() {
  const keys = bannedKeysFromEnv();
  const db = getSupabaseAdmin();
  if (!db) return keys;

  const [bansRes, statusRes] = await Promise.all([
    db.from('banned_wallets').select('wallet_address'),
    db.from('wallet_account_status').select('wallet').eq('status', 'banned'),
  ]);

  for (const row of bansRes.data ?? []) {
    const key = normalizeWallet(String(row.wallet_address ?? ''));
    if (key) keys.add(key);
  }
  for (const row of statusRes.data ?? []) {
    const key = normalizeWallet(String(row.wallet ?? ''));
    if (key) keys.add(key);
  }
  return keys;
}

export function walletMatchesBanSet(wallet, banned) {
  if (!wallet?.trim() || banned.size === 0) return false;
  return banned.has(normalizeWallet(wallet.trim()));
}

export function filterBannedWalletRows(rows, banned, getWallet) {
  if (banned.size === 0) return rows;
  return rows.filter((row) => !walletMatchesBanSet(String(getWallet(row) ?? ''), banned));
}

export async function getWalletAccountStatus(address) {
  if (isBannedViaEnv(address)) return 'banned';
  const db = getSupabaseAdmin();
  if (!db) return 'active';

  const key = normalizeWallet(address);
  const [{ data: ban }, { data: statusRow }] = await Promise.all([
    db.from('banned_wallets').select('wallet_address').eq('wallet_address', key).maybeSingle(),
    db.from('wallet_account_status').select('status').eq('wallet', key).maybeSingle(),
  ]);
  if (ban) return 'banned';
  if (statusRow?.status === 'frozen' || statusRow?.status === 'banned') return statusRow.status;
  return 'active';
}

export async function assertWalletCanPlay(address) {
  const status = await getWalletAccountStatus(address);
  if (status === 'banned') return 'This wallet is banned from the platform.';
  if (status === 'frozen') return 'This wallet account is frozen. Contact support.';
  return null;
}
