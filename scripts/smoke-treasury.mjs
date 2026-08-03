import fs from 'node:fs';
import { createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:4410';
const TREASURY_ADDRESS = '0x0F455b5a385c508142a2861e0f541550119afA28';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RPC = 'https://base-sepolia.drpc.org';

function readEnv() {
  const source = fs.readFileSync(new URL('../contracts/.env', import.meta.url), 'utf8');
  return Object.fromEntries(source.split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}
const env = readEnv();
const playerKey = env.PRIVATE_KEY_SMOKE_TEST;
const account = privateKeyToAccount(playerKey);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC, { timeout: 20_000, retryCount: 3 }) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC, { timeout: 20_000, retryCount: 3 }) });
const usdcAbi = parseAbi(['function transfer(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)']);

async function post(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${path}: ${json.error || res.status}`);
  return json;
}
async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json();
}

const walletBalanceBefore = await publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [account.address] });

console.error(`[treasury-smoke] wallet ${account.address}, on-chain USDC before: ${formatUnits(walletBalanceBefore, 6)}`);

// 1. Deposit — a real on-chain USDC transfer to the treasury, then tell the backend about it.
// Kept small — this wallet's testnet USDC is shared with the direct-wallet smoke run.
const depositRaw = parseUnits('0.8', 6);
const depositRequest = await publicClient.simulateContract({ account, address: USDC, abi: usdcAbi, functionName: 'transfer', args: [TREASURY_ADDRESS, depositRaw], gas: 100_000n });
const depositTxHash = await walletClient.writeContract(depositRequest.request);
console.error(`[treasury-smoke] deposit transfer: ${depositTxHash}`);
await publicClient.waitForTransactionReceipt({ hash: depositTxHash, confirmations: 2 });
const depositResult = await post('/api/treasury/deposit', { wallet: account.address, txHash: depositTxHash });
console.error(`[treasury-smoke] deposit credited, balanceRaw=${depositResult.balanceRaw}`);

const balanceAfterDeposit = await get(`/api/treasury/balance?wallet=${account.address}`);

// 2. One wallet signature issues a 24h session — every round after this needs zero signatures.
const nonce = Date.now().toString();
const message = `AptCasino treasury-session-${nonce} for ${account.address.toLowerCase()}`;
const signature = await account.signMessage({ message });
const session = await post('/api/treasury/session', { wallet: account.address, nonce, signature });
console.error(`[treasury-smoke] session token acquired, expires ${session.expiresAt}`);

const rounds = [];

// 3. Play each game via the treasury (house-balance) path — zero further signatures.
const rouletteResult = await post('/api/treasury/play', {
  game: 'roulette', bets: [{ betType: 1, selection: 0, numbers: [], wagerRaw: '150000' }],
}, session.token);
rounds.push({ game: 'roulette', ...rouletteResult });
console.error(`[treasury-smoke] roulette settled: ${rouletteResult.settleHash}, balanceRaw=${rouletteResult.balanceRaw}`);

const wheelResult = await post('/api/treasury/play', { game: 'wheel', risk: 1, segments: 20, wagerRaw: '150000' }, session.token);
rounds.push({ game: 'wheel', ...wheelResult });
console.error(`[treasury-smoke] wheel settled: ${wheelResult.settleHash}, balanceRaw=${wheelResult.balanceRaw}`);

const plinkoResult = await post('/api/treasury/play', { game: 'plinko', risk: 1, rows: 12, wagerRaw: '150000' }, session.token);
rounds.push({ game: 'plinko', ...plinkoResult });
console.error(`[treasury-smoke] plinko settled: ${plinkoResult.settleHash}, balanceRaw=${plinkoResult.balanceRaw}`);

// Mines: start -> reveal a couple tiles -> cash out.
const minesStart = await post('/api/treasury/mines/start', { mineCount: 3, wagerRaw: '150000' }, session.token);
console.error(`[treasury-smoke] mines start: ${minesStart.startHash}, commit: ${minesStart.commitHash}`);
let mineOutcome = { hitMine: false };
for (let tile = 0; tile < 25 && !mineOutcome.hitMine; tile += 1) {
  mineOutcome = await post('/api/treasury/mines/reveal', { gameId: minesStart.gameId, tile }, session.token);
  console.error(`[treasury-smoke] mines revealTile(${tile}): ${mineOutcome.hash}, hitMine=${mineOutcome.hitMine}`);
  if (tile >= 1) break; // reveal 2 tiles then cash out, unless we bust first
}
let minesResult;
if (mineOutcome.hitMine) {
  minesResult = { game: 'mines', busted: true, hash: mineOutcome.hash };
} else {
  const cashout = await post('/api/treasury/mines/cashout', { gameId: minesStart.gameId }, session.token);
  console.error(`[treasury-smoke] mines cashOut: ${cashout.hash}, payoutRaw=${cashout.payoutRaw}, balanceRaw=${cashout.balanceRaw}`);
  minesResult = { game: 'mines', busted: false, ...cashout };
}
rounds.push(minesResult);

const balanceAfterPlay = await get(`/api/treasury/balance?wallet=${account.address}`);
const walletBalanceAfterPlay = await publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [account.address] });

// 4. Withdraw whatever's left back to the wallet — a real on-chain payout from the treasury.
let withdrawResult = null;
if (balanceAfterPlay.balanceRaw > 0) {
  withdrawResult = await post('/api/treasury/withdraw', { amountRaw: balanceAfterPlay.balanceRaw }, session.token);
  console.error(`[treasury-smoke] withdraw: ${withdrawResult.txHash}, balanceRaw=${withdrawResult.balanceRaw}`);
  await publicClient.waitForTransactionReceipt({ hash: withdrawResult.txHash, confirmations: 2 });
}

const walletBalanceAfterWithdraw = await publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [account.address] });

// 5. Megapot off-chain credit ledger — see report for known migration blocker.
const megapotCredits = await get(`/api/treasury/megapot/credits?wallet=${account.address}`);

console.log(JSON.stringify({
  account: account.address,
  walletUsdcBeforeDeposit: formatUnits(walletBalanceBefore, 6),
  depositTxHash,
  balanceRawAfterDeposit: balanceAfterDeposit.balanceRaw,
  rounds,
  balanceRawAfterPlay: balanceAfterPlay.balanceRaw,
  walletUsdcAfterPlay_shouldEqualAfterDeposit: formatUnits(walletBalanceAfterPlay, 6),
  withdrawResult,
  walletUsdcAfterWithdraw: formatUnits(walletBalanceAfterWithdraw, 6),
  megapotCredits,
}, null, 2));
