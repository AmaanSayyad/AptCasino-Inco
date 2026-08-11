import { createPublicClient, createWalletClient, http, pad, parseEventLogs, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Lightning } from '@inco/lightning-js/lite';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS, isContractConfigured } from '@/lib/baseSepolia';
import { aptCasinoAbi, aptCasinoAddress } from '@/lib/contracts/aptCasino';
import { usdcAbi, usdcAddress } from '@/lib/contracts/usdc';

const OUTCOME_EVENTS = { roulette: 'RouletteOutcome', wheel: 'WheelOutcome', plinko: 'PlinkoOutcome' };

// Tuned for Base Sepolia latency: shorter backoff, fewer wasted outer waits.
const REVEAL_BACKOFF = { maxRetries: 6, baseDelayInMs: 800, backoffFactor: 1.15 };
const REVEAL_OUTER_ATTEMPTS = 24;
const REVEAL_OUTER_SLEEP_MS = 600;
const RECEIPT_CONFIRMATIONS = 1;

let account = null;
export function treasuryAddress() {
  if (!process.env.TREASURY_PRIVATE_KEY) return null;
  if (!account) account = privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY);
  return account.address;
}

const transport = http(BASE_SEPOLIA_RPC_URLS[0], { retryCount: 2, timeout: 20_000 });
const publicClient = createPublicClient({ chain: APTCASINO_CHAIN, transport });
function walletClient() {
  privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY);
  return createWalletClient({ account: privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY), chain: APTCASINO_CHAIN, transport });
}

let lightningPromise = null;
function getLightning() {
  if (!lightningPromise) lightningPromise = Lightning.baseSepoliaTestnet();
  return lightningPromise;
}

async function attestedReveal(seedHandle) {
  const lightning = await getLightning();
  let lastError;
  for (let attempt = 0; attempt < REVEAL_OUTER_ATTEMPTS; attempt++) {
    try {
      const [result] = await lightning.attestedReveal([seedHandle], { backoffConfig: REVEAL_BACKOFF });
      const raw = result.plaintext.value;
      const value = pad(toHex(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw), { size: 32 });
      return { attestation: { handle: result.handle, value }, signatures: result.covalidatorSignatures.map((s) => toHex(s)) };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, REVEAL_OUTER_SLEEP_MS));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Inco reveal timed out');
}

// ponytail: single Node process serializes treasury txs to avoid nonce races.
let chain = Promise.resolve();
function serialized(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

/** One large approve so per-round play skips the 2-confirmation approve path. */
async function ensureAllowance(wallet, spender, wager) {
  const readAllowance = () => publicClient.readContract({ address: usdcAddress, abi: usdcAbi, functionName: 'allowance', args: [wallet.account.address, spender] });
  if ((await readAllowance()) >= wager) return;
  // Approve a large buffer once (1000x max wager class) to avoid re-approve on every round.
  const amount = wager * 10_000n < 1_000_000_000_000n ? 1_000_000_000_000n : wager * 10_000n;
  const approveHash = await wallet.writeContract({ address: usdcAddress, abi: usdcAbi, functionName: 'approve', args: [spender, amount] });
  await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: RECEIPT_CONFIRMATIONS });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await readAllowance()) >= wager) return;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error('USDC allowance did not propagate after approve');
}

/**
 * Executes one confidential round using the treasury's own on-chain funds/signature.
 */
export function playAndSettle({ game, functionName, args, wager }) {
  return serialized(async () => {
    if (!isContractConfigured(aptCasinoAddress)) throw new Error('AptCasino contract is not configured.');
    const wallet = walletClient();
    const fee = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });
    await ensureAllowance(wallet, aptCasinoAddress, wager);

    const playHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName, args, value: fee });
    const playReceipt = await publicClient.waitForTransactionReceipt({ hash: playHash, confirmations: RECEIPT_CONFIRMATIONS });
    const [placed] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: playReceipt.logs });
    if (!placed) throw new Error('BetPlaced event was not found');

    const { attestation, signatures } = await attestedReveal(placed.args.seedHandle);

    const settleHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'settle', args: [placed.args.gameId, attestation, signatures] });
    const settleReceipt = await publicClient.waitForTransactionReceipt({ hash: settleHash, confirmations: RECEIPT_CONFIRMATIONS });
    const [settled] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetSettled', logs: settleReceipt.logs });
    const [outcome] = parseEventLogs({ abi: aptCasinoAbi, eventName: OUTCOME_EVENTS[game], logs: settleReceipt.logs });
    if (!settled || !outcome) throw new Error('Settlement events were not found');

    return { gameId: placed.args.gameId, playHash, settleHash, payout: settled.args.payout, outcome: outcome.args };
  });
}

/** Locks the wager and commits the Inco-attested mine layout. */
export function startAndCommitMines({ mineCount, wager }) {
  return serialized(async () => {
    if (!isContractConfigured(aptCasinoAddress)) throw new Error('AptCasino contract is not configured.');
    const wallet = walletClient();
    const fee = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });
    await ensureAllowance(wallet, aptCasinoAddress, wager);

    const startHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'startMines', args: [mineCount, wager], value: fee });
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash, confirmations: RECEIPT_CONFIRMATIONS });
    const [placed] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: startReceipt.logs });
    if (!placed) throw new Error('BetPlaced event was not found');

    const { attestation, signatures } = await attestedReveal(placed.args.seedHandle);

    const commitHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'commitMines', args: [placed.args.gameId, attestation, signatures] });
    await publicClient.waitForTransactionReceipt({ hash: commitHash, confirmations: RECEIPT_CONFIRMATIONS });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const session = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getMinesSession', args: [placed.args.gameId] });
      if (session[4]) break; // committed
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    return { gameId: placed.args.gameId, startHash, commitHash };
  });
}

export function revealMinesTileTreasury({ gameId, tile }) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'revealTile', args: [gameId, tile] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: RECEIPT_CONFIRMATIONS });
    const busted = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesBusted', logs: receipt.logs })[0];
    const revealed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesTileRevealed', logs: receipt.logs });
    const revealedTiles = revealed.map((e) => Number(e.args.tile));
    const lastRevealed = revealed[revealed.length - 1];
    return {
      hash,
      hitMine: Boolean(busted),
      minePositions: busted?.args.minePositions,
      revealedCount: lastRevealed?.args.revealedCount ?? busted?.args.tile,
      revealedTiles,
    };
  });
}

/** Batch multi-tile reveal — one tx for several tiles (stops on mine on-chain). */
export function revealMinesTilesTreasury({ gameId, tiles }) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({
      address: aptCasinoAddress,
      abi: aptCasinoAbi,
      functionName: 'revealTiles',
      args: [gameId, tiles],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: RECEIPT_CONFIRMATIONS });
    const busted = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesBusted', logs: receipt.logs })[0];
    const revealed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesTileRevealed', logs: receipt.logs });
    return {
      hash,
      hitMine: Boolean(busted),
      minePositions: busted?.args.minePositions,
      revealedCount: revealed[revealed.length - 1]?.args.revealedCount,
      revealedTiles: revealed.map((e) => Number(e.args.tile)),
    };
  });
}

export function cashOutMinesTreasury({ gameId }) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'cashOut', args: [gameId] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: RECEIPT_CONFIRMATIONS });
    const cashedOut = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesCashedOut', logs: receipt.logs })[0];
    if (!cashedOut) throw new Error('MinesCashedOut event was not found');
    return { hash, payout: cashedOut.args.payout, minePositions: cashedOut.args.minePositions };
  });
}

export function sendUsdc(to, amount) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: usdcAddress, abi: usdcAbi, functionName: 'transfer', args: [to, amount] });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: RECEIPT_CONFIRMATIONS });
    return hash;
  });
}

export { publicClient };
