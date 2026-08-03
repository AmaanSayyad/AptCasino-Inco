import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const APTCASINO = '0xa9B94c3F2Cf7110AA7425618362FCC2643316B25';
const rpc = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
const account = privateKeyToAccount(process.env.PRIVATE_KEY_BASE_SEPOLIA);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
const walletClient = createWalletClient({ chain: baseSepolia, account, transport: http(rpc) });

const abi = parseAbi([
  'event BetPlaced(uint256 indexed gameId, address indexed player, uint256 wager, bytes32 seedHandle, uint8 kind)',
  'event BetSettled(uint256 indexed gameId, address indexed player, uint256 wager, uint256 payout, uint8 kind)',
  'event BetExpired(uint256 indexed gameId, address indexed player, uint256 refund)',
  'event MinesBusted(uint256 indexed gameId, uint8 tile, uint8[] minePositions)',
  'event MinesCashedOut(uint256 indexed gameId, uint256 payout, uint8 revealedCount, uint8[] minePositions)',
  'function expireGame(uint256 gameId)',
  'function expireMines(uint256 gameId)',
  'function totalActiveLiability() view returns (uint256)',
]);

const latest = await publicClient.getBlockNumber();
const fromBlock = latest > 45000n ? latest - 45000n : 0n; // ~24h at ~2s/block, generous for this session's testing window
const CHUNK = 1900n; // public RPC caps eth_getLogs at 2000 blocks

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getEvents(eventName) {
  const all = [];
  for (let start = fromBlock; start <= latest; start += CHUNK + 1n) {
    const end = start + CHUNK > latest ? latest : start + CHUNK;
    let logs;
    for (let attempt = 1; ; attempt++) {
      try {
        logs = await publicClient.getContractEvents({ address: APTCASINO, abi, eventName, fromBlock: start, toBlock: end });
        break;
      } catch (err) {
        if (attempt >= 5) throw err;
        await sleep(1500 * attempt);
      }
    }
    all.push(...logs);
    await sleep(250);
  }
  return all;
}

const placed = await getEvents('BetPlaced');
const settled = await getEvents('BetSettled');
const expired = await getEvents('BetExpired');
const busted = await getEvents('MinesBusted');
const cashedOut = await getEvents('MinesCashedOut');

const resolvedIds = new Set([
  ...settled.map((e) => e.args.gameId.toString()),
  ...expired.map((e) => e.args.gameId.toString()),
  ...busted.map((e) => e.args.gameId.toString()),
  ...cashedOut.map((e) => e.args.gameId.toString()),
]);

const KIND = { 0: 'Roulette', 1: 'Wheel', 2: 'Plinko', 3: 'Mines' };
const orphans = placed.filter((e) => !resolvedIds.has(e.args.gameId.toString()));

console.log(`Scanned ${placed.length} BetPlaced events from block ${fromBlock} to ${latest}.`);
console.log(`${orphans.length} orphaned (never settled/expired/busted/cashed-out) game(s) found:`);
for (const e of orphans) {
  console.log(`  gameId=${e.args.gameId} kind=${KIND[e.args.kind]} wager=${Number(e.args.wager) / 1e6} USDC player=${e.args.player} block=${e.blockNumber}`);
}

const liabilityBefore = await publicClient.readContract({ address: APTCASINO, abi, functionName: 'totalActiveLiability' });
console.log(`\ntotalActiveLiability before: ${Number(liabilityBefore) / 1e6} USDC`);

for (const e of orphans) {
  const gameId = e.args.gameId;
  const kind = e.args.kind;
  const fn = kind === 3 ? 'expireMines' : 'expireGame';
  try {
    const { request } = await publicClient.simulateContract({ address: APTCASINO, abi, functionName: fn, args: [gameId], account });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`${fn}(${gameId}) -> ${receipt.status} (${hash})`);
  } catch (err) {
    console.log(`${fn}(${gameId}) FAILED: ${err.shortMessage || err.message}`);
  }
}

const liabilityAfter = await publicClient.readContract({ address: APTCASINO, abi, functionName: 'totalActiveLiability' });
console.log(`\ntotalActiveLiability after: ${Number(liabilityAfter) / 1e6} USDC`);
