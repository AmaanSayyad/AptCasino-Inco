'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { runConfidentialGame } from '@/lib/inco/gameEngine';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';
import { isContractConfigured } from '@/lib/baseSepolia';
import { useTreasuryAccount } from '@/lib/treasury/useTreasuryAccount';
import { friendlyWalletError } from '@/lib/walletError';

// Mines is a multi-step session (start/reveal/cashOut), not a single play->settle
// round — see src/lib/inco/useMinesSession.js, which the mines page uses instead.
const OUTCOME_EVENTS = { roulette: 'RouletteOutcome', wheel: 'WheelOutcome', plinko: 'PlinkoOutcome' };
const PLAY_FUNCTIONS = { roulette: 'playRoulette', wheel: 'playWheel', plinko: 'playPlinko' };

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
  // House balance is the default, matching the original app — direct per-round
  // wallet signing ('wallet' mode) stays available for players who prefer it.
  const [mode, setMode] = useState('treasury');
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
  const treasury = useTreasuryAccount();

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
      setError(friendlyWalletError(playError, 'The round could not be completed.'));
      return null;
    }
  }

  /**
   * Roulette-only: places several simultaneous chips in one round (each with its own
   * stake), matching a real table. `bets` is [{ betType, selection, numbers?, amount }],
   * `amount` a USDC string per chip, `numbers` only for betType 6 (covered numbers —
   * split/street/corner/six-line). Total wager (for approve/allowance) is the sum of chips.
   */
  async function playBets(bets) {
    if (!address || game !== 'roulette') return null;
    setError('');
    setResult(null);
    try {
      const rawBets = bets.map((bet) => ({
        betType: bet.betType, selection: bet.selection ?? 0, numbers: bet.numbers ?? [], wager: parseUnits(bet.amount, USDC_DECIMALS),
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
      setError(friendlyWalletError(playError, 'The round could not be completed.'));
      return null;
    }
  }

  /**
   * House-balance mode: no wallet signature per round (see useTreasuryAccount — one
   * signature issues a session, then the server signs play+settle with its own funds
   * and adjusts the player's off-chain balance). `payload` is the game-specific body
   * `/api/treasury/play` expects (e.g. { risk, segments, wagerRaw } for wheel,
   * { bets: [...] } for roulette) minus `game`, which this adds.
   */
  async function playTreasury(payload) {
    if (!address) return null;
    setError('');
    setResult(null);
    setStage('betting');
    try {
      const active = await treasury.ensureSession();
      const response = await fetch('/api/treasury/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.token}` },
        body: JSON.stringify({ game, ...payload }),
      }).then((r) => r.json());
      if (!response.ok) throw new Error(response.error || 'The round could not be completed.');
      setStage('done');
      const normalized = { gameId: response.outcome?.gameId, playHash: response.playHash, settleHash: response.settleHash, outcome: response.outcome };
      setResult(normalized);
      treasury.refreshBalance();
      creditsRead.refetch();
      return normalized;
    } catch (playError) {
      setStage('error');
      setError(friendlyWalletError(playError, 'The round could not be completed.'));
      return null;
    }
  }

  const outcome = result?.outcome;
  const payout = outcome?.payout != null ? formatUnits(outcome.payout, USDC_DECIMALS) : null;
  const busy = ['approving', 'betting', 'revealing', 'settling'].includes(stage);

  return {
    address, isConnected, wager, setWager, mode, setMode, stage, error, result, outcome, payout, play, playBets, playTreasury, busy,
    credits, vaultConfigured, claim, claimPending, claimReceiptLoading: claimReceipt.isLoading,
    rewardVaultAbi, rewardVaultAddress, settleHash: result?.settleHash,
    treasury,
  };
}
