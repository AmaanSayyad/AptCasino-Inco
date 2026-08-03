import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  pad,
  parseAbi,
  parseUnits,
  parseEventLogs,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const require = createRequire(import.meta.url);
const { Lightning } = require('@inco/lightning-js/lite');

const CASINO = '0xa9B94c3F2Cf7110AA7425618362FCC2643316B25';
const VAULT = '0x492B94E48C5D3d05745A162796A1c70c1979bbeC';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RPC = 'https://base-sepolia.drpc.org';

const casinoAbi = parseAbi([
  'function getFee() view returns (uint256)',
  'function playRoulette((uint8 betType, uint8 selection, uint8[] numbers, uint256 wager)[] bets) payable returns (uint256 gameId)',
  'function playWheel(uint8 risk, uint8 segments, uint256 wager) payable returns (uint256 gameId)',
  'function playPlinko(uint8 risk, uint8 rows, uint256 wager) payable returns (uint256 gameId)',
  'function settle(uint256 gameId, (bytes32 handle, bytes32 value) attestation, bytes[] signatures)',
  'function startMines(uint8 mineCount, uint256 wager) payable returns (uint256 gameId)',
  'function commitMines(uint256 gameId, (bytes32 handle, bytes32 value) attestation, bytes[] signatures)',
  'function getMinesSession(uint256 gameId) view returns (address player, uint256 wager, uint8 mineCount, uint8 revealedCount, bool committed, bool active)',
  'function revealTile(uint256 gameId, uint8 tile) returns (bool hitMine)',
  'function cashOut(uint256 gameId) returns (uint256 payout)',
  'event BetPlaced(uint256 indexed gameId, address indexed player, uint256 wager, bytes32 seedHandle, uint8 kind)',
  'event BetSettled(uint256 indexed gameId, address indexed player, uint256 wager, uint256 payout, uint8 kind)',
  'event RouletteOutcome(uint256 indexed gameId, uint8 winningNumber, uint256 payout)',
  'event WheelOutcome(uint256 indexed gameId, uint8 segment, uint256 multiplierBps, uint256 payout)',
  'event PlinkoOutcome(uint256 indexed gameId, uint8 bucket, uint256 multiplierBps, uint256 payout)',
  'event MinesCommitted(uint256 indexed gameId)',
  'event MinesTileRevealed(uint256 indexed gameId, uint8 tile, uint8 revealedCount)',
  'event MinesBusted(uint256 indexed gameId, uint8 tile, uint8[] minePositions)',
  'event MinesCashedOut(uint256 indexed gameId, uint256 payout, uint8 revealedCount, uint8[] minePositions)',
]);

const usdcAbi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const vaultAbi = parseAbi([
  'function credits(address player) view returns (uint256)',
  'function claimTicket() returns (uint256 ticketId)',
  'event TicketClaimed(address indexed player, uint256 indexed ticketId, uint256 price)',
]);

function readEnv() {
  const source = fs.readFileSync(new URL('../contracts/.env', import.meta.url), 'utf8');
  return Object.fromEntries(source.split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

const env = readEnv();
// Uses a dedicated player wallet (not the contract-owner deployer key) so smoke
// runs never touch the deployer's bankroll/gas funds.
const playerKey = env.PRIVATE_KEY_SMOKE_TEST || env.PRIVATE_KEY_BASE_SEPOLIA;
if (!/^0x[0-9a-fA-F]{64}$/.test(playerKey || '')) {
  throw new Error('PRIVATE_KEY_SMOKE_TEST (or PRIVATE_KEY_BASE_SEPOLIA) is missing or invalid');
}

const account = privateKeyToAccount(playerKey);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC, { timeout: 20_000, retryCount: 3 }) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC, { timeout: 20_000, retryCount: 3 }) });
const lightning = await Lightning.baseSepoliaTestnet();

async function reveal(seedHandle) {
  let lastError;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const [result] = await lightning.attestedReveal([seedHandle], {
        backoffConfig: { maxRetries: 8, baseDelayInMs: 2_000, backoffFactor: 1.2 },
      });
      const raw = result.plaintext.value;
      return {
        attestation: {
          handle: result.handle,
          value: pad(toHex(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw), { size: 32 }),
        },
        signatures: result.covalidatorSignatures.map((signature) => toHex(signature)),
      };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  throw lastError || new Error('Inco reveal timed out');
}

async function ensureAllowance(wager) {
  const readAllowance = () => publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'allowance', args: [account.address, CASINO] });
  if ((await readAllowance()) >= wager) return;
  // Approve headroom for all 4 rounds at once so we only pay this once per run.
  const approveAmount = wager * 10n;
  const request = await publicClient.simulateContract({ account, address: USDC, abi: usdcAbi, functionName: 'approve', args: [CASINO, approveAmount], gas: 100_000n });
  const hash = await walletClient.writeContract(request.request);
  console.error(`[smoke] USDC approve: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  // Public RPC nodes can lag a block behind the one that confirmed the receipt; poll until it's visible.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await readAllowance()) >= wager) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('USDC allowance did not propagate after approve');
}

async function playRound(definition, wager, fee) {
  await ensureAllowance(wager);
  const request = await publicClient.simulateContract({
    account,
    address: CASINO,
    abi: casinoAbi,
    functionName: definition.functionName,
    args: definition.args(wager),
    value: fee,
    gas: 2_000_000n,
  });
  const playHash = await walletClient.writeContract(request.request);
  console.error(`[smoke] ${definition.name} play: ${playHash}`);
  const playReceipt = await publicClient.waitForTransactionReceipt({ hash: playHash });
  if (playReceipt.status !== 'success') throw new Error(`${definition.name}: play reverted (${playHash})`);
  const [placed] = parseEventLogs({ abi: casinoAbi, eventName: 'BetPlaced', logs: playReceipt.logs });
  if (!placed) throw new Error(`${definition.name}: BetPlaced missing`);

  const revealed = await reveal(placed.args.seedHandle);
  const settleRequest = await publicClient.simulateContract({
    account,
    address: CASINO,
    abi: casinoAbi,
    functionName: 'settle',
    args: [placed.args.gameId, revealed.attestation, revealed.signatures],
    gas: 3_000_000n,
  });
  const settleHash = await walletClient.writeContract(settleRequest.request);
  console.error(`[smoke] ${definition.name} settle: ${settleHash}`);
  const settleReceipt = await publicClient.waitForTransactionReceipt({ hash: settleHash });
  if (settleReceipt.status !== 'success') throw new Error(`${definition.name}: settlement reverted (${settleHash})`);
  const [settled] = parseEventLogs({ abi: casinoAbi, eventName: 'BetSettled', logs: settleReceipt.logs });
  const [outcome] = parseEventLogs({ abi: casinoAbi, eventName: definition.outcomeEvent, logs: settleReceipt.logs });
  if (!settled || !outcome) throw new Error(`${definition.name}: settlement events missing`);

  return {
    game: definition.name,
    gameId: placed.args.gameId.toString(),
    playHash,
    settleHash,
    payoutUsdc: formatUnits(settled.args.payout, 6),
    outcome: JSON.parse(JSON.stringify(outcome.args, (_, value) => typeof value === 'bigint' ? value.toString() : value)),
  };
}

async function playMinesSession(wager, fee) {
  await ensureAllowance(wager);
  const startRequest = await publicClient.simulateContract({ account, address: CASINO, abi: casinoAbi, functionName: 'startMines', args: [5, wager], value: fee, gas: 2_000_000n });
  const startHash = await walletClient.writeContract(startRequest.request);
  console.error(`[smoke] mines start: ${startHash}`);
  const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash });
  const [placed] = parseEventLogs({ abi: casinoAbi, eventName: 'BetPlaced', logs: startReceipt.logs });
  if (!placed) throw new Error('mines: BetPlaced missing');

  const revealed = await reveal(placed.args.seedHandle);
  const commitRequest = await publicClient.simulateContract({ account, address: CASINO, abi: casinoAbi, functionName: 'commitMines', args: [placed.args.gameId, revealed.attestation, revealed.signatures], gas: 3_000_000n });
  const commitHash = await walletClient.writeContract(commitRequest.request);
  console.error(`[smoke] mines commit: ${commitHash}`);
  await publicClient.waitForTransactionReceipt({ hash: commitHash, confirmations: 2 });
  // Public RPC nodes can lag a block behind the one that confirmed the receipt; poll until it's visible.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const session = await publicClient.readContract({ address: CASINO, abi: casinoAbi, functionName: 'getMinesSession', args: [placed.args.gameId] });
    if (session[4]) break; // committed
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  // Reveal tiles one at a time (the whole point: incremental, stop-anytime) until
  // we've safely revealed 3, or hit a mine.
  let revealedSafe = 0;
  let busted = false;
  let lastReceipt;
  for (let tile = 0; tile < 25 && revealedSafe < 3 && !busted; tile += 1) {
    const revealRequest = await publicClient.simulateContract({ account, address: CASINO, abi: casinoAbi, functionName: 'revealTile', args: [placed.args.gameId, tile], gas: 500_000n });
    const revealHash = await walletClient.writeContract(revealRequest.request);
    lastReceipt = await publicClient.waitForTransactionReceipt({ hash: revealHash });
    console.error(`[smoke] mines revealTile(${tile}): ${revealHash}`);
    const [busted_] = parseEventLogs({ abi: casinoAbi, eventName: 'MinesBusted', logs: lastReceipt.logs });
    if (busted_) { busted = true; console.error(`[smoke] mines busted on tile ${tile}, mines were:`, busted_.args.minePositions); break; }
    revealedSafe += 1;
  }

  if (busted) return { game: 'mines', gameId: placed.args.gameId.toString(), busted: true, revealedSafe, payoutUsdc: '0' };

  const cashOutRequest = await publicClient.simulateContract({ account, address: CASINO, abi: casinoAbi, functionName: 'cashOut', args: [placed.args.gameId], gas: 500_000n });
  const cashOutHash = await walletClient.writeContract(cashOutRequest.request);
  const cashOutReceipt = await publicClient.waitForTransactionReceipt({ hash: cashOutHash });
  const [cashedOut] = parseEventLogs({ abi: casinoAbi, eventName: 'MinesCashedOut', logs: cashOutReceipt.logs });
  console.error(`[smoke] mines cashOut: ${cashOutHash}`);
  return {
    game: 'mines', gameId: placed.args.gameId.toString(), busted: false, revealedSafe,
    playHash: startHash, settleHash: cashOutHash, payoutUsdc: formatUnits(cashedOut.args.payout, 6),
  };
}

// Kept small relative to the seeded bankroll — wheel/plinko can pay out up to
// 10x-16x the wager, and a bigger wager here can exceed a modest test bankroll's
// availableBankroll() and revert with InsufficientBankroll.
const wager = parseUnits('0.5', 6);
const fee = await publicClient.readContract({ address: CASINO, abi: casinoAbi, functionName: 'getFee' });
const definitions = [
  { kind: 0, name: 'roulette', functionName: 'playRoulette', args: (value) => [[{ betType: 1, selection: 0, numbers: [], wager: value }]], outcomeEvent: 'RouletteOutcome' },
  { kind: 0, name: 'roulette-split', functionName: 'playRoulette', args: (value) => [[{ betType: 6, selection: 0, numbers: [7, 8], wager: value }]], outcomeEvent: 'RouletteOutcome' },
  { kind: 1, name: 'wheel', functionName: 'playWheel', args: (value) => [1, 20, value], outcomeEvent: 'WheelOutcome' },
  { kind: 2, name: 'plinko', functionName: 'playPlinko', args: (value) => [1, 12, value], outcomeEvent: 'PlinkoOutcome' },
];

const rounds = [];
for (const definition of definitions) {
  rounds.push(await playRound(definition, wager, fee));
}
rounds.push(await playMinesSession(wager, fee));

let creditsBeforeClaim = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'credits', args: [account.address] });
// Top up with extra low-risk rounds (deterministic 100 credits/round regardless of
// win/loss, at a 1 USDC wager) until this wallet can actually afford a 1000-credit
// claim — proves the direct-wallet Megapot path end-to-end rather than skipping it.
const topUpWager = parseUnits('1', 6);
while (creditsBeforeClaim < 1_000n) {
  const topUp = await playRound(definitions[0], topUpWager, fee);
  rounds.push({ ...topUp, note: 'megapot credit top-up round' });
  creditsBeforeClaim = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'credits', args: [account.address] });
}
let ticket = null;
let creditsAfterClaim = creditsBeforeClaim;
if (creditsBeforeClaim >= 1_000n) {
  const claimRequest = await publicClient.simulateContract({ account, address: VAULT, abi: vaultAbi, functionName: 'claimTicket', gas: 5_000_000n });
  const claimHash = await walletClient.writeContract(claimRequest.request);
  console.error(`[smoke] Megapot ticket claim: ${claimHash}`);
  const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
  if (claimReceipt.status !== 'success') throw new Error(`Megapot claim reverted (${claimHash})`);
  const [claimed] = parseEventLogs({ abi: vaultAbi, eventName: 'TicketClaimed', logs: claimReceipt.logs });
  if (!claimed) throw new Error('TicketClaimed event missing');
  ticket = { ticketId: claimed.args.ticketId.toString(), priceRaw: claimed.args.price.toString(), claimHash };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    creditsAfterClaim = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'credits', args: [account.address] });
    if (creditsAfterClaim <= creditsBeforeClaim - 1_000n) break;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
} else {
  console.error(`[smoke] Skipping Megapot claim — only ${creditsBeforeClaim} credits (need 1000)`);
}
console.log(JSON.stringify({
  account: account.address,
  wagerUsdc: formatUnits(wager, 6),
  incoFeeEth: formatUnits(fee, 18),
  rounds,
  creditsBeforeClaim: creditsBeforeClaim.toString(),
  ticket,
  creditsAfterClaim: creditsAfterClaim.toString(),
}, null, 2));
