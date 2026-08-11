import { Lightning } from '@inco/lightning-js/lite';
import { pad, parseEventLogs, toHex, type Address, type Hex } from 'viem';
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi';
import { aptCasinoAbi, aptCasinoAddress } from '@/lib/contracts/aptCasino';
import { usdcAbi, usdcAddress } from '@/lib/contracts/usdc';
import { isContractConfigured } from '@/lib/baseSepolia';

type Stage = 'approving' | 'betting' | 'revealing' | 'settling' | 'done';
type PlayFunction = 'playRoulette' | 'playWheel' | 'playPlinko';

let lightningPromise: ReturnType<typeof Lightning.baseSepoliaTestnet> | null = null;
function getLightning() {
  if (!lightningPromise) lightningPromise = Lightning.baseSepoliaTestnet();
  return lightningPromise;
}

async function reveal(seedHandle: Hex) {
  const lightning = await getLightning();
  let lastError: unknown;
  // Tuned for Base Sepolia: shorter backoff / outer wait than the prior 3s×40 path.
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const [result] = await lightning.attestedReveal([seedHandle], {
        backoffConfig: { maxRetries: 6, baseDelayInMs: 800, backoffFactor: 1.15 },
      });
      const raw = result.plaintext.value;
      const value = pad(toHex(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw), { size: 32 });
      return {
        attestation: { handle: result.handle as Hex, value },
        signatures: result.covalidatorSignatures.map((signature: Uint8Array) => toHex(signature)),
      };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Inco reveal timed out');
}

export async function runConfidentialGame({
  account,
  functionName,
  args,
  wager,
  outcomeEvent,
  onStage,
}: {
  account: Address;
  functionName: PlayFunction;
  args: readonly unknown[];
  wager: bigint;
  outcomeEvent: 'RouletteOutcome' | 'WheelOutcome' | 'PlinkoOutcome';
  onStage?: (stage: Stage) => void;
}) {
  if (!isContractConfigured(aptCasinoAddress)) {
    throw new Error('AptCasino contract is not deployed yet. Set NEXT_PUBLIC_APTCASINO_ADDRESS.');
  }
  const fee = await readContract(wagmiConfig, { address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });
  const request = { address: aptCasinoAddress, abi: aptCasinoAbi, functionName, args, value: fee, account } as const;

  const allowance = await readContract(wagmiConfig, {
    address: usdcAddress, abi: usdcAbi, functionName: 'allowance', args: [account, aptCasinoAddress],
  });
  if (allowance < wager) {
    onStage?.('approving');
    const approveHash = await writeContract(wagmiConfig, {
      address: usdcAddress, abi: usdcAbi, functionName: 'approve', args: [aptCasinoAddress, wager], account,
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
  }

  onStage?.('betting');
  // The runtime function/args pair is selected by the four game adapters above;
  // viem cannot preserve that discriminated tuple after it crosses this shared helper.
  await simulateContract(wagmiConfig, request as any);
  const playHash = await writeContract(wagmiConfig, request as any);
  const playReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: playHash });
  const placed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: playReceipt.logs });
  if (!placed[0]) throw new Error('BetPlaced event was not found');
  const { gameId, seedHandle } = placed[0].args;

  onStage?.('revealing');
  const { attestation, signatures } = await reveal(seedHandle);

  onStage?.('settling');
  const settleHash = await writeContract(wagmiConfig, {
    address: aptCasinoAddress,
    abi: aptCasinoAbi,
    functionName: 'settle',
    args: [gameId, attestation, signatures],
  });
  const settleReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: settleHash });
  const outcomes = parseEventLogs({ abi: aptCasinoAbi, eventName: outcomeEvent, logs: settleReceipt.logs });
  if (!outcomes[0]) throw new Error(`${outcomeEvent} was not found`);
  onStage?.('done');
  return { gameId, playHash, settleHash, outcome: outcomes[0].args };
}

/**
 * Mines is a longer-lived session, not a single play->settle round: start locks the
 * wager and commits an Inco seed (attested + committed here), then the caller reveals
 * tiles one at a time (revealMinesTile) and cashes out whenever (cashOutMines) — see
 * AptCasino.sol's startMines/commitMines/revealTile/cashOut for why.
 */
export async function startMinesSession({
  account, mineCount, wager, onStage,
}: { account: Address; mineCount: number; wager: bigint; onStage?: (stage: Stage) => void }) {
  if (!isContractConfigured(aptCasinoAddress)) {
    throw new Error('AptCasino contract is not deployed yet. Set NEXT_PUBLIC_APTCASINO_ADDRESS.');
  }
  const fee = await readContract(wagmiConfig, { address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'getFee' });

  const allowance = await readContract(wagmiConfig, {
    address: usdcAddress, abi: usdcAbi, functionName: 'allowance', args: [account, aptCasinoAddress],
  });
  if (allowance < wager) {
    onStage?.('approving');
    const approveHash = await writeContract(wagmiConfig, {
      address: usdcAddress, abi: usdcAbi, functionName: 'approve', args: [aptCasinoAddress, wager], account,
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
  }

  onStage?.('betting');
  const startHash = await writeContract(wagmiConfig, {
    address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'startMines', args: [mineCount, wager], value: fee, account,
  });
  const startReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: startHash });
  const placed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetPlaced', logs: startReceipt.logs });
  if (!placed[0]) throw new Error('BetPlaced event was not found');
  const { gameId, seedHandle } = placed[0].args;

  onStage?.('revealing');
  const { attestation, signatures } = await reveal(seedHandle);

  onStage?.('settling');
  const commitHash = await writeContract(wagmiConfig, {
    address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'commitMines', args: [gameId, attestation, signatures], account,
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: commitHash });
  onStage?.('done');
  return { gameId, startHash, commitHash };
}

export async function revealMinesTile({ account, gameId, tile }: { account: Address; gameId: bigint; tile: number }) {
  const hash = await writeContract(wagmiConfig, {
    address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'revealTile', args: [gameId, tile], account,
  });
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  const busted = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesBusted', logs: receipt.logs })[0];
  const revealed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesTileRevealed', logs: receipt.logs })[0];
  return { hash, hitMine: Boolean(busted), minePositions: busted?.args.minePositions, revealedCount: revealed?.args.revealedCount };
}

export async function revealMinesTiles({ account, gameId, tiles }: { account: Address; gameId: bigint; tiles: number[] }) {
  const hash = await writeContract(wagmiConfig, {
    address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'revealTiles', args: [gameId, tiles], account,
  });
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  const busted = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesBusted', logs: receipt.logs })[0];
  const revealed = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesTileRevealed', logs: receipt.logs });
  return {
    hash,
    hitMine: Boolean(busted),
    minePositions: busted?.args.minePositions,
    revealedCount: revealed[revealed.length - 1]?.args.revealedCount,
    revealedTiles: revealed.map((e) => Number(e.args.tile)),
  };
}

export async function cashOutMines({ account, gameId }: { account: Address; gameId: bigint }) {
  const hash = await writeContract(wagmiConfig, {
    address: aptCasinoAddress, abi: aptCasinoAbi, functionName: 'cashOut', args: [gameId], account,
  });
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  const cashedOut = parseEventLogs({ abi: aptCasinoAbi, eventName: 'MinesCashedOut', logs: receipt.logs })[0];
  if (!cashedOut) throw new Error('MinesCashedOut event was not found');
  return { hash, payout: cashedOut.args.payout, minePositions: cashedOut.args.minePositions };
}
