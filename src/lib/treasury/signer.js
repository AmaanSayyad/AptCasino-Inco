import { createPublicClient, createWalletClient, http, pad, parseEventLogs, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Lightning } from '@inco/lightning-js/lite';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS, isContractConfigured } from '@/lib/baseSepolia';
import { aptCasinoAbi, aptCasinoAddress } from '@/lib/contracts/aptCasino';
import { usdcAbi, usdcAddress } from '@/lib/contracts/usdc';
import { maxPicksForBankroll, minePositions, plinkoOutcome } from '@/lib/games/outcomeFromSeed';

const OUTCOME_EVENTS = { roulette: 'RouletteOutcome', wheel: 'WheelOutcome', plinko: 'PlinkoOutcome' };
// Not in the app-wide ABI (nothing else needs it) — mines sizing reads it once per session.
const bankrollAbi = [{ name: 'availableBankroll', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }];

// The covalidators reject a fresh handle ("ciphertext not found", then "acl disallowed")
// for the first few seconds after the play tx lands, so this is a poll, not an error
// path — measured 1.7s to ~15s to clear. Long inner backoffs just oversleep past the
// moment it becomes available, so keep each attempt short and re-poll often; the
// attempt count still covers ~2 minutes total.
const REVEAL_BACKOFF = { maxRetries: 2, baseDelayInMs: 400, backoffFactor: 1.3 };
const REVEAL_OUTER_ATTEMPTS = 60;
const REVEAL_OUTER_SLEEP_MS = 400;
const RECEIPT_CONFIRMATIONS = 1;

let account = null;
export function treasuryAddress() {
  if (!process.env.TREASURY_PRIVATE_KEY) return null;
  if (!account) account = privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY);
  return account.address;
}

const transport = http(BASE_SEPOLIA_RPC_URLS[0], { retryCount: 2, timeout: 20_000 });
// ponytail: viem's default pollingInterval is 4s, so every waitForTransactionReceipt
// below burned up to 4s *after* the block already landed (Base blocks are 2s). A
// plinko round waits on 2 receipts, a mines tile on 1 — this is the single biggest
// source of the "game feels slow" latency. 250ms if RPC rate limits bite, raise it.
const publicClient = createPublicClient({ chain: APTCASINO_CHAIN, transport, pollingInterval: 250 });
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

// ponytail: getFee is contract config, not per-round state — 60s TTL cache instead of
// an RPC read before every single play/start. Owner fee changes take <=60s to apply.
let feeCache = { value: null, at: 0 };
async function getFeeCached() {
  if (feeCache.value != null && Date.now() - feeCache.at < 60_000) return feeCache.value;
  const value = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });
  feeCache = { value, at: Date.now() };
  return value;
}

// ponytail: local mirror of the treasury's on-chain USDC allowance. Decremented
// optimistically per round so the common case costs zero RPC reads; drifting LOW just
// forces a re-read (safe direction), never a skipped approve.
let allowanceCache = null;

/** One large approve so per-round play skips the 2-confirmation approve path. */
async function ensureAllowance(wallet, spender, wager) {
  const readAllowance = () => publicClient.readContract({ address: usdcAddress, abi: usdcAbi, functionName: 'allowance', args: [wallet.account.address, spender] });
  if (allowanceCache == null || allowanceCache < wager) allowanceCache = await readAllowance();
  if (allowanceCache >= wager) { allowanceCache -= wager; return; }
  // Approve a large buffer once (1000x max wager class) to avoid re-approve on every round.
  const amount = wager * 10_000n < 1_000_000_000_000n ? 1_000_000_000_000n : wager * 10_000n;
  const approveHash = await wallet.writeContract({ address: usdcAddress, abi: usdcAbi, functionName: 'approve', args: [spender, amount] });
  await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: RECEIPT_CONFIRMATIONS });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const fresh = await readAllowance();
    if (fresh >= wager) { allowanceCache = fresh - wager; return; }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error('USDC allowance did not propagate after approve');
}

/**
 * Background check for a settlement we already answered the player from. Nothing to
 * recover automatically — a mismatch means outcomeFromSeed.js drifted from the
 * contract, which is a code bug, so make it loud in the logs.
 */
function watchSettlement(settleHash, gameId, expectedPayout) {
  void publicClient.waitForTransactionReceipt({ hash: settleHash, confirmations: RECEIPT_CONFIRMATIONS })
    .then((receipt) => {
      if (receipt.status !== 'success') {
        console.error('settle tx reverted', { gameId: gameId.toString(), settleHash });
        return;
      }
      const [settled] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetSettled', logs: receipt.logs });
      if (settled && settled.args.payout !== expectedPayout) {
        console.error('PAYOUT MISMATCH — outcomeFromSeed.js is out of sync with AptCasino.sol', {
          gameId: gameId.toString(), settleHash, onChain: settled.args.payout.toString(), local: expectedPayout.toString(),
        });
      }
    })
    .catch((error) => console.error('settle receipt watch failed', { gameId: gameId.toString(), settleHash, error }));
}

/**
 * Executes one confidential round using the treasury's own on-chain funds/signature.
 */
export function playAndSettle({ game, functionName, args, wager }) {
  return serialized(async () => {
    if (!isContractConfigured(aptCasinoAddress)) throw new Error('AptCasino contract is not configured.');
    const wallet = walletClient();
    const [fee] = await Promise.all([getFeeCached(), ensureAllowance(wallet, aptCasinoAddress, wager)]);

    const playHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName, args, value: fee });
    const playReceipt = await publicClient.waitForTransactionReceipt({ hash: playHash, confirmations: RECEIPT_CONFIRMATIONS });
    const [placed] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: playReceipt.logs });
    if (!placed) throw new Error('BetPlaced event was not found');

    const { attestation, signatures } = await attestedReveal(placed.args.seedHandle);

    const settleHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'settle', args: [placed.args.gameId, attestation, signatures] });

    // ponytail: plinko's result is a pure function of the seed we just attested, so the
    // player doesn't have to wait ~1.5s for the settle block — the tx is broadcast (and
    // can't revert for bankroll: maxPayout was reserved at play time), and the same
    // numbers the contract will emit are derived locally. Verified against 6 real
    // settled rounds. Roulette/wheel keep the read-it-from-the-receipt path.
    if (game === 'plinko') {
      const local = plinkoOutcome({ risk: Number(args[0]), rows: Number(args[1]), wager, seed: BigInt(attestation.value) });
      watchSettlement(settleHash, placed.args.gameId, local.payout);
      return {
        gameId: placed.args.gameId,
        playHash,
        settleHash,
        payout: local.payout,
        outcome: { gameId: placed.args.gameId, bucket: local.bucket, multiplierBps: local.multiplierBps, payout: local.payout },
      };
    }

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
    const [fee] = await Promise.all([getFeeCached(), ensureAllowance(wallet, aptCasinoAddress, wager)]);

    const startHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'startMines', args: [mineCount, wager], value: fee });
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash, confirmations: RECEIPT_CONFIRMATIONS });
    const [placed] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: startReceipt.logs });
    if (!placed) throw new Error('BetPlaced event was not found');

    const { attestation, signatures } = await attestedReveal(placed.args.seedHandle);

    const commitHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'commitMines', args: [placed.args.gameId, attestation, signatures] });
    await publicClient.waitForTransactionReceipt({ hash: commitHash, confirmations: RECEIPT_CONFIRMATIONS });

    // The layout is now fixed on-chain and is a pure function of the seed we just
    // attested, so derive it here: every later tile click can be answered from it
    // without waiting on a block. Verified against 3 real finished sessions.
    const positions = minePositions(BigInt(attestation.value), mineCount);
    const bankroll = await publicClient.readContract({ address: aptCasinoAddress, abi: bankrollAbi, functionName: 'availableBankroll' });
    // revealTile() reserves liability incrementally and reverts past what the bankroll
    // covers — stop the player at that pick instead of letting a reveal fail on-chain.
    const maxPicks = maxPicksForBankroll(wager, mineCount, bankroll);

    return { gameId: placed.args.gameId, startHash, commitHash, minePositions: positions, maxPicks };
  });
}

/**
 * Reveals one tile. The caller already knows the answer from the session's stored
 * layout, so this only broadcasts the tx (~300ms) instead of waiting for its block
 * (~2s) — the receipt is watched in the background purely to surface reverts. The
 * treasury's txs are nonce-ordered by serialized(), so the later cashOut still
 * executes after every reveal it follows.
 */
export function revealMinesTileTreasury({ gameId, tile }) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'revealTile', args: [gameId, tile] });
    void publicClient.waitForTransactionReceipt({ hash, confirmations: RECEIPT_CONFIRMATIONS })
      .then((receipt) => { if (receipt.status !== 'success') console.error('revealTile reverted', { gameId: gameId.toString(), tile, hash }); })
      .catch((error) => console.error('revealTile receipt watch failed', { gameId: gameId.toString(), tile, hash, error }));
    return { hash };
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
