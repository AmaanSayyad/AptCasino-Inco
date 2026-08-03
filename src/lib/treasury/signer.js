import { createPublicClient, createWalletClient, http, pad, parseEventLogs, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Lightning } from '@inco/lightning-js/lite';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS, isContractConfigured } from '@/lib/baseSepolia';
import { aptCasinoAbi, aptCasinoAddress } from '@/lib/contracts/aptCasino';
import { usdcAbi, usdcAddress } from '@/lib/contracts/usdc';

const OUTCOME_EVENTS = { roulette: 'RouletteOutcome', wheel: 'WheelOutcome', plinko: 'PlinkoOutcome' };

let account = null;
export function treasuryAddress() {
  if (!process.env.TREASURY_PRIVATE_KEY) return null;
  if (!account) account = privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY);
  return account.address;
}

const transport = http(BASE_SEPOLIA_RPC_URLS[0], { retryCount: 2, timeout: 20_000 });
const publicClient = createPublicClient({ chain: APTCASINO_CHAIN, transport });
function walletClient() {
  privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY); // throws early if misconfigured
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
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const [result] = await lightning.attestedReveal([seedHandle], { backoffConfig: { maxRetries: 8, baseDelayInMs: 2_000, backoffFactor: 1.2 } });
      const raw = result.plaintext.value;
      const value = pad(toHex(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw), { size: 32 });
      return { attestation: { handle: result.handle, value }, signatures: result.covalidatorSignatures.map((s) => toHex(s)) };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Inco reveal timed out');
}

// ponytail: single Node process serializes treasury txs to avoid nonce races.
// Not safe across multiple server instances — fine for this deployment's scale,
// upgrade to a proper tx queue/nonce manager if this ever runs multi-instance.
let chain = Promise.resolve();
function serialized(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

/** Public RPC nodes can lag a block behind the one that confirmed a receipt — the very
 *  next call (e.g. a transferFrom relying on this allowance) can hit a stale node and
 *  see the old value. Wait for 2 confirmations, then poll until the read is consistent. */
async function ensureAllowance(wallet, spender, wager) {
  const readAllowance = () => publicClient.readContract({ address: usdcAddress, abi: usdcAbi, functionName: 'allowance', args: [wallet.account.address, spender] });
  if ((await readAllowance()) >= wager) return;
  const approveHash = await wallet.writeContract({ address: usdcAddress, abi: usdcAbi, functionName: 'approve', args: [spender, wager * 100n] });
  await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 2 });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await readAllowance()) >= wager) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('USDC allowance did not propagate after approve');
}

/**
 * Executes one confidential round using the treasury's own on-chain funds/signature
 * (the player never signs anything here — see src/app/api/treasury/play/route.js for
 * the balance bookkeeping this wraps). Mirrors gameEngine.ts's runConfidentialGame but
 * with a viem wallet client instead of @wagmi/core (no browser wallet available server-side).
 */
export function playAndSettle({ game, functionName, args, wager }) {
  return serialized(async () => {
    if (!isContractConfigured(aptCasinoAddress)) throw new Error('AptCasino contract is not configured.');
    const wallet = walletClient();
    const fee = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });
    await ensureAllowance(wallet, aptCasinoAddress, wager);

    const playHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName, args, value: fee });
    const playReceipt = await publicClient.waitForTransactionReceipt({ hash: playHash });
    const [placed] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: playReceipt.logs });
    if (!placed) throw new Error('BetPlaced event was not found');

    const { attestation, signatures } = await attestedReveal(placed.args.seedHandle);

    const settleHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'settle', args: [placed.args.gameId, attestation, signatures] });
    const settleReceipt = await publicClient.waitForTransactionReceipt({ hash: settleHash });
    const [settled] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetSettled', logs: settleReceipt.logs });
    const [outcome] = parseEventLogs({ abi: aptCasinoAbi, eventName: OUTCOME_EVENTS[game], logs: settleReceipt.logs });
    if (!settled || !outcome) throw new Error('Settlement events were not found');

    return { gameId: placed.args.gameId, playHash, settleHash, payout: settled.args.payout, outcome: outcome.args };
  });
}

/** Locks the wager and commits the Inco-attested mine layout — the incremental part
 *  (revealMinesTileTreasury/cashOutMinesTreasury below) happens over later calls. */
export function startAndCommitMines({ mineCount, wager }) {
  return serialized(async () => {
    if (!isContractConfigured(aptCasinoAddress)) throw new Error('AptCasino contract is not configured.');
    const wallet = walletClient();
    const fee = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });
    await ensureAllowance(wallet, aptCasinoAddress, wager);

    const startHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'startMines', args: [mineCount, wager], value: fee });
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash });
    const [placed] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: startReceipt.logs });
    if (!placed) throw new Error('BetPlaced event was not found');

    const { attestation, signatures } = await attestedReveal(placed.args.seedHandle);

    const commitHash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'commitMines', args: [placed.args.gameId, attestation, signatures] });
    await publicClient.waitForTransactionReceipt({ hash: commitHash, confirmations: 2 });
    // Public RPC nodes can lag a block behind the one that confirmed the receipt.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const session = await publicClient.readContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getMinesSession', args: [placed.args.gameId] });
      if (session[4]) break; // committed
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }

    return { gameId: placed.args.gameId, startHash, commitHash };
  });
}

export function revealMinesTileTreasury({ gameId, tile }) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'revealTile', args: [gameId, tile] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const busted = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesBusted', logs: receipt.logs })[0];
    const revealed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesTileRevealed', logs: receipt.logs })[0];
    return { hash, hitMine: Boolean(busted), minePositions: busted?.args.minePositions, revealedCount: revealed?.args.revealedCount };
  });
}

export function cashOutMinesTreasury({ gameId }) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'cashOut', args: [gameId] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const cashedOut = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesCashedOut', logs: receipt.logs })[0];
    if (!cashedOut) throw new Error('MinesCashedOut event was not found');
    return { hash, payout: cashedOut.args.payout, minePositions: cashedOut.args.minePositions };
  });
}

export function sendUsdc(to, amount) {
  return serialized(async () => {
    const wallet = walletClient();
    const hash = await wallet.writeContract({ address: usdcAddress, abi: usdcAbi, functionName: 'transfer', args: [to, amount] });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  });
}

export { publicClient };
