'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { runConfidentialGame } from '@/lib/inco/gameEngine';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';
import { isContractConfigured } from '@/lib/baseSepolia';

const OUTCOME_EVENTS = { roulette: 'RouletteOutcome', wheel: 'WheelOutcome', plinko: 'PlinkoOutcome', mines: 'MinesOutcome' };
const PLAY_FUNCTIONS = { roulette: 'playRoulette', wheel: 'playWheel', plinko: 'playPlinko', mines: 'playMines' };

export const stageCopy = {
  idle: 'Ready', approving: 'Approving USDC', betting: 'Locking wager on Base',
  revealing: 'Waiting for Inco covalidators', settling: 'Verifying attestation on-chain',
  done: 'Settled', error: 'Action needed',
};
export const stageProgress = { idle: 0, approving: 14, betting: 32, revealing: 64, settling: 84, done: 100, error: 100 };

/** Shared betting/settlement logic for the 4 confidential games (do not change gameEngine.ts semantics here). */
export function useConfidentialGame(game) {
  const { address, isConnected } = useAccount();
  const [wager, setWager] = useState('1');
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const vaultConfigured = isContractConfigured(rewardVaultAddress);
  const creditsRead = useReadContract({
    address: rewardVaultAddress,
    abi: rewardVaultAbi,
    functionName: 'credits',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && vaultConfigured), refetchInterval: 15_000 },
  });
  const { writeContract: claim, data: claimHash, isPending: claimPending } = useWriteContract();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimHash });
  const credits = Number(creditsRead.data ?? 0n);

  async function play(betArgs) {
    if (!address) return null;
    setError('');
    setResult(null);
    try {
      const wagerRaw = parseUnits(wager, USDC_DECIMALS);
      const response = await runConfidentialGame({
        account: address,
        functionName: PLAY_FUNCTIONS[game],
        args: [...betArgs, wagerRaw],
        wager: wagerRaw,
        outcomeEvent: OUTCOME_EVENTS[game],
        onStage: setStage,
      });
      setResult(response);
      creditsRead.refetch();
      // Best-effort history/leaderboard record — the round is already settled on-chain
      // regardless of whether this call succeeds, so failures here are logged, not thrown.
      fetch('/api/games/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, game, txHash: response.settleHash }),
      }).catch((logError) => console.error('game history log failed', logError));
      return response;
    } catch (playError) {
      setStage('error');
      setError(playError instanceof Error ? playError.message : 'The round could not be completed.');
      return null;
    }
  }

  /**
   * Roulette-only: places several simultaneous chips in one round (each with its own
   * stake), matching a real table. `bets` is [{ betType, selection, amount }], `amount`
   * a USDC string per chip. Total wager (for approve/allowance) is the sum of chips.
   */
  async function playBets(bets) {
    if (!address || game !== 'roulette') return null;
    setError('');
    setResult(null);
    try {
      const rawBets = bets.map((bet) => ({
        betType: bet.betType, selection: bet.selection, wager: parseUnits(bet.amount, USDC_DECIMALS),
      }));
      const totalWagerRaw = rawBets.reduce((sum, bet) => sum + bet.wager, 0n);
      const response = await runConfidentialGame({
        account: address,
        functionName: 'playRoulette',
        args: [rawBets],
        wager: totalWagerRaw,
        outcomeEvent: 'RouletteOutcome',
        onStage: setStage,
      });
      setResult(response);
      creditsRead.refetch();
      fetch('/api/games/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, game, txHash: response.settleHash }),
      }).catch((logError) => console.error('game history log failed', logError));
      return response;
    } catch (playError) {
      setStage('error');
      setError(playError instanceof Error ? playError.message : 'The round could not be completed.');
      return null;
    }
  }

  const outcome = result?.outcome;
  const payout = outcome?.payout != null ? formatUnits(outcome.payout, USDC_DECIMALS) : null;
  const busy = ['approving', 'betting', 'revealing', 'settling'].includes(stage);

  return {
    address, isConnected, wager, setWager, stage, error, result, outcome, payout, play, playBets, busy,
    credits, vaultConfigured, claim, claimPending, claimReceiptLoading: claimReceipt.isLoading,
    rewardVaultAbi, rewardVaultAddress, settleHash: result?.settleHash,
  };
}
