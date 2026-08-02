import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  pad,
  parseAbi,
  parseEther,
  parseEventLogs,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const require = createRequire(import.meta.url);
const { Lightning } = require('@inco/lightning-js/lite');

const CASINO = '0xD75b282f87a00856FBF4Aa06bf65833d4AB4b5D7';
const VAULT = '0xccec75B83b3Ee3FBAED9a65Da59DBfd585F82943';
const RPC = 'https://base-sepolia.drpc.org';

const casinoAbi = parseAbi([
  'function getFee() view returns (uint256)',
  'function playRoulette(uint8 betType, uint8 selection, uint256 wager) payable returns (uint256 gameId)',
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
if (!/^0x[0-9a-fA-F]{64}$/.test(env.PRIVATE_KEY_BASE_SEPOLIA || '')) {
  throw new Error('PRIVATE_KEY_BASE_SEPOLIA is missing or invalid');
}

const account = privateKeyToAccount(env.PRIVATE_KEY_BASE_SEPOLIA);
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

async function playRound(definition, wager, fee) {
  const request = await publicClient.simulateContract({
    account,
    address: CASINO,
    abi: casinoAbi,
    functionName: definition.functionName,
    args: definition.args(wager),
    value: wager + fee,
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
    payoutEth: formatEther(settled.args.payout),
    outcome: JSON.parse(JSON.stringify(outcome.args, (_, value) => typeof value === 'bigint' ? value.toString() : value)),
  };
}

const wager = parseEther('0.00025');
const fee = await publicClient.readContract({ address: CASINO, abi: casinoAbi, functionName: 'getFee' });
const definitions = [
  { kind: 0, name: 'roulette', functionName: 'playRoulette', args: (value) => [1, 0, value], outcomeEvent: 'RouletteOutcome' },
  { kind: 1, name: 'wheel', functionName: 'playWheel', args: (value) => [1, 20, value], outcomeEvent: 'WheelOutcome' },
  { kind: 2, name: 'plinko', functionName: 'playPlinko', args: (value) => [1, 12, value], outcomeEvent: 'PlinkoOutcome' },
  { kind: 3, name: 'mines', functionName: 'playMines', args: (value) => [[0, 6, 12], 5, value], outcomeEvent: 'MinesOutcome' },
];

const rounds = [];
for (const definition of definitions) {
  rounds.push(await playRound(definition, wager, fee));
}

let creditsBeforeClaim = 0n;
for (let attempt = 0; attempt < 20; attempt += 1) {
  creditsBeforeClaim = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'credits', args: [account.address] });
  if (creditsBeforeClaim >= 1_000n) break;
  await new Promise((resolve) => setTimeout(resolve, 3_000));
}
if (creditsBeforeClaim < 1_000n) throw new Error(`Expected at least 1000 credits, received ${creditsBeforeClaim}`);
const claimRequest = await publicClient.simulateContract({ account, address: VAULT, abi: vaultAbi, functionName: 'claimTicket', gas: 5_000_000n });
const claimHash = await walletClient.writeContract(claimRequest.request);
console.error(`[smoke] Megapot ticket claim: ${claimHash}`);
const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
if (claimReceipt.status !== 'success') throw new Error(`Megapot claim reverted (${claimHash})`);
const [claimed] = parseEventLogs({ abi: vaultAbi, eventName: 'TicketClaimed', logs: claimReceipt.logs });
if (!claimed) throw new Error('TicketClaimed event missing');

let creditsAfterClaim = creditsBeforeClaim;
for (let attempt = 0; attempt < 20; attempt += 1) {
  creditsAfterClaim = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'credits', args: [account.address] });
  if (creditsAfterClaim <= creditsBeforeClaim - 1_000n) break;
  await new Promise((resolve) => setTimeout(resolve, 3_000));
}
console.log(JSON.stringify({
  account: account.address,
  wagerEth: formatEther(wager),
  incoFeeEth: formatEther(fee),
  rounds,
  creditsBeforeClaim: creditsBeforeClaim.toString(),
  ticket: { ticketId: claimed.args.ticketId.toString(), priceRaw: claimed.args.price.toString(), claimHash },
  creditsAfterClaim: creditsAfterClaim.toString(),
}, null, 2));
