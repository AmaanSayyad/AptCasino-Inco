/**
 * Megapot Data API client (Base Sepolia testnet by default).
 * @see https://llms.megapot.io/data-api
 */

const DEFAULT_BASE = process.env.MEGAPOT_DATA_API_URL || 'https://api-testnet.megapot.io/v1';

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.MEGAPOT_DATA_API_KEY) {
    h.Authorization = `Bearer ${process.env.MEGAPOT_DATA_API_KEY}`;
  }
  return h;
}

async function getJson(path) {
  const res = await fetch(`${DEFAULT_BASE}${path}`, { headers: headers(), next: { revalidate: 15 } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code || res.status;
    const message = body?.error?.message || res.statusText;
    const err = new Error(`Megapot API ${code}: ${message}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchActiveRound() {
  return getJson('/rounds/active');
}

export async function fetchLatestSettledRound() {
  return getJson('/rounds/latest-settled');
}

export async function fetchRoundPlayers(roundId, limit = 20) {
  return getJson(`/rounds/${roundId}/players?limit=${limit}`);
}

export async function fetchRoundWins(roundId, limit = 10) {
  return getJson(`/rounds/${roundId}/wins?limit=${limit}`);
}

export async function fetchWalletStats(address) {
  return getJson(`/wallets/${address}/stats`);
}

export async function fetchWalletTickets(address, limit = 20) {
  return getJson(`/wallets/${address}/tickets?limit=${limit}`);
}

export async function fetchUnclaimedWins(address, limit = 50) {
  return getJson(`/wallets/${address}/wins?claimed=false&limit=${limit}`);
}

export function amountToUsdc(amountObj) {
  if (!amountObj?.amount) return 0;
  const decimals = amountObj.decimals ?? 6;
  return Number(amountObj.amount) / 10 ** decimals;
}
