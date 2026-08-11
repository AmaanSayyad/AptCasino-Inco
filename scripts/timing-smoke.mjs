import { createPublicClient, createWalletClient, http, parseUnits, parseEventLogs, pad, toHex, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Lightning } = require('@inco/lightning-js/lite');

const CASINO = process.env.NEXT_PUBLIC_APTCASINO_ADDRESS;
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const key = process.env.TREASURY_PRIVATE_KEY.startsWith('0x') ? process.env.TREASURY_PRIVATE_KEY : '0x'+process.env.TREASURY_PRIVATE_KEY;
const account = privateKeyToAccount(key);
const rpc = 'https://base-sepolia-rpc.publicnode.com';
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc, { timeout: 30000 }) });
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpc, { timeout: 30000 }) });

const casinoAbi = parseAbi([
  'function getFee() view returns (uint256)',
  'function playPlinko(uint8 risk, uint8 rows, uint256 wager) payable returns (uint256 gameId)',
  'function settle(uint256 gameId, (bytes32 handle, bytes32 value) attestation, bytes[] signatures)',
  'function startMines(uint8 mineCount, uint256 wager) payable returns (uint256 gameId)',
  'function commitMines(uint256 gameId, (bytes32 handle, bytes32 value) attestation, bytes[] signatures)',
  'function revealTile(uint256 gameId, uint8 tile) returns (bool hitMine)',
  'function cashOut(uint256 gameId) returns (uint256 payout)',
  'function availableBankroll() view returns (uint256)',
  'error InsufficientBankroll()',
  'event BetPlaced(uint256 indexed gameId, address indexed player, uint256 wager, bytes32 seedHandle, uint8 kind)',
  'event PlinkoOutcome(uint256 indexed gameId, uint8 bucket, uint256 multiplierBps, uint256 payout)',
  'event MinesTileRevealed(uint256 indexed gameId, uint8 tile, uint8 revealedCount)',
  'event MinesBusted(uint256 indexed gameId, uint8 tile, uint8[] minePositions)',
]);
const usdcAbi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const lightning = await Lightning.baseSepoliaTestnet();
async function attestedReveal(seedHandle) {
  let lastError; const t0 = Date.now();
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const [result] = await lightning.attestedReveal([seedHandle], { backoffConfig: { maxRetries: 6, baseDelayInMs: 800, backoffFactor: 1.15 } });
      const raw = result.plaintext.value;
      return {
        attestation: { handle: result.handle, value: pad(toHex(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw), { size: 32 }) },
        signatures: result.covalidatorSignatures.map((s) => toHex(s)),
        ms: Date.now() - t0,
        attempts: attempt + 1,
      };
    } catch (e) { lastError = e; await new Promise((r) => setTimeout(r, 600)); }
  }
  throw lastError || new Error('reveal timeout');
}

const fee = await publicClient.readContract({ address: CASINO, abi: casinoAbi, functionName: 'getFee' });
const bankroll = await publicClient.readContract({ address: CASINO, abi: casinoAbi, functionName: 'availableBankroll' });
console.log(JSON.stringify({ bankrollUsdc: Number(bankroll)/1e6, feeWei: fee.toString() }));

const wager = parseUnits('0.1', 6);
const allow = await publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'allowance', args: [account.address, CASINO] });
if (allow < wager) {
  const h = await wallet.writeContract({ address: USDC, abi: usdcAbi, functionName: 'approve', args: [CASINO, 10n ** 15n] });
  await publicClient.waitForTransactionReceipt({ hash: h, confirmations: 1 });
}

// PLINKO
{
  const tAll = Date.now();
  const tPlay0 = Date.now();
  const playHash = await wallet.writeContract({ address: CASINO, abi: casinoAbi, functionName: 'playPlinko', args: [1, 8, wager], value: fee });
  const playReceipt = await publicClient.waitForTransactionReceipt({ hash: playHash, confirmations: 1 });
  const playMs = Date.now() - tPlay0;
  const [placed] = parseEventLogs({ abi: casinoAbi, eventName: 'BetPlaced', logs: playReceipt.logs });
  const rev = await attestedReveal(placed.args.seedHandle);
  const tSettle0 = Date.now();
  const settleHash = await wallet.writeContract({ address: CASINO, abi: casinoAbi, functionName: 'settle', args: [placed.args.gameId, rev.attestation, rev.signatures] });
  const settleReceipt = await publicClient.waitForTransactionReceipt({ hash: settleHash, confirmations: 1 });
  const settleMs = Date.now() - tSettle0;
  const [outcome] = parseEventLogs({ abi: casinoAbi, eventName: 'PlinkoOutcome', logs: settleReceipt.logs });
  console.log(JSON.stringify({ game: 'plinko', totalMs: Date.now()-tAll, playMs, revealMs: rev.ms, revealAttempts: rev.attempts, settleMs, bucket: Number(outcome.args.bucket), multBps: outcome.args.multiplierBps.toString(), payout: outcome.args.payout.toString() }));
}

// MINES
{
  const tAll = Date.now();
  const tStart0 = Date.now();
  const startHash = await wallet.writeContract({ address: CASINO, abi: casinoAbi, functionName: 'startMines', args: [3, wager], value: fee });
  const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash, confirmations: 1 });
  const startMs = Date.now() - tStart0;
  const [placed] = parseEventLogs({ abi: casinoAbi, eventName: 'BetPlaced', logs: startReceipt.logs });
  const rev = await attestedReveal(placed.args.seedHandle);
  const tCommit0 = Date.now();
  const commitHash = await wallet.writeContract({ address: CASINO, abi: casinoAbi, functionName: 'commitMines', args: [placed.args.gameId, rev.attestation, rev.signatures] });
  await publicClient.waitForTransactionReceipt({ hash: commitHash, confirmations: 1 });
  const commitMs = Date.now() - tCommit0;
  const tTile0 = Date.now();
  // try a few tiles until safe or bust
  let hitMine = false; let tileMs = 0; let cashMs = null;
  for (let tile = 0; tile < 5; tile++) {
    const t0 = Date.now();
    const rh = await wallet.writeContract({ address: CASINO, abi: casinoAbi, functionName: 'revealTile', args: [placed.args.gameId, tile] });
    const rr = await publicClient.waitForTransactionReceipt({ hash: rh, confirmations: 1 });
    tileMs = Date.now() - t0;
    const busted = parseEventLogs({ abi: casinoAbi, eventName: 'MinesBusted', logs: rr.logs })[0];
    if (busted) { hitMine = true; break; }
    // cash out after first safe
    const tC = Date.now();
    const ch = await wallet.writeContract({ address: CASINO, abi: casinoAbi, functionName: 'cashOut', args: [placed.args.gameId] });
    await publicClient.waitForTransactionReceipt({ hash: ch, confirmations: 1 });
    cashMs = Date.now() - tC;
    break;
  }
  console.log(JSON.stringify({ game: 'mines', totalMs: Date.now()-tAll, startMs, revealMs: rev.ms, revealAttempts: rev.attempts, commitMs, tileMs, cashMs, hitMine }));
}
