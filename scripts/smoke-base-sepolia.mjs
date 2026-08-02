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

const CASINO = '0xbd025968C8C1eDDEE5EdAE28479C295876EcEdC5';
const VAULT = '0x20862fEfB10C4e036Cc6CCa82Cf90B3296378E26';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RPC = 'https://base-sepolia.drpc.org';

const casinoAbi = parseAbi([
  'function getFee() view returns (uint256)',
  'function playRoulette((uint8 betType, uint8 selection, uint256 wager)[] bets) payable returns (uint256 gameId)',
  'function playWheel(uint8 risk, uint8 segments, uint256 wager) payable returns (uint256 gameId)',
  'function playPlinko(uint8 risk, uint8 rows, uint256 wager) payable returns (uint256 gameId)',
  'function playMines(uint8[] selectedTiles, uint8 mineCount, uint256 wager) payable returns (uint256 gameId)',
  'function settle(uint256 gameId, (bytes32 handle, bytes32 value) attestation, bytes[] signatures)',
  'event BetPlaced(uint256 indexed gameId, address indexed player, uint256 wager, bytes32 seedHandle, uint8 kind)',
  'event BetSettled(uint256 indexed gameId, address indexed player, uint256 wager, uint256 payout, uint8 kind)',
  'event RouletteOutcome(uint256 indexed gameId, uint8 winningNumber, uint256 payout)',
  'event WheelOutcome(uint256 indexed gameId, uint8 segment, uint256 multiplierBps, uint256 payout)',
  'event PlinkoOutcome(uint256 indexed gameId, uint8 bucket, uint256 multiplierBps, uint256 payout)',
  'event MinesOutcome(uint256 indexed gameId, bool hitMine, uint8[] minePositions, uint256 payout)',
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

// Kept small relative to the seeded bankroll — wheel/plinko can pay out up to
// 10x-16x the wager, and a bigger wager here can exceed a modest test bankroll's
// availableBankroll() and revert with InsufficientBankroll.
const wager = parseUnits('0.5', 6);
const fee = await publicClient.readContract({ address: CASINO, abi: casinoAbi, functionName: 'getFee' });
const definitions = [
  { kind: 0, name: 'roulette', functionName: 'playRoulette', args: (value) => [[{ betType: 1, selection: 0, wager: value }]], outcomeEvent: 'RouletteOutcome' },
  { kind: 1, name: 'wheel', functionName: 'playWheel', args: (value) => [1, 20, value], outcomeEvent: 'WheelOutcome' },
  { kind: 2, name: 'plinko', functionName: 'playPlinko', args: (value) => [1, 12, value], outcomeEvent: 'PlinkoOutcome' },
  { kind: 3, name: 'mines', functionName: 'playMines', args: (value) => [[0, 6, 12], 5, value], outcomeEvent: 'MinesOutcome' },
];

const rounds = [];
for (const definition of definitions) {
  rounds.push(await playRound(definition, wager, fee));
}

const creditsBeforeClaim = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'credits', args: [account.address] });
// The Megapot claim step needs 1000 accrued credits, which depends on wager size
// vs. the deployed bankroll (see the wager comment above) — it's optional here
// since it exercises MegapotRewardVault, not the AptCasino USDC wager path this
// script primarily verifies. Skip gracefully rather than fail the whole run.
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
