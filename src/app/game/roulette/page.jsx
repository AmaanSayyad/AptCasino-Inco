'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useReadContract } from 'wagmi';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useConfidentialGame, stageCopy } from '@/lib/inco/useConfidentialGame';
import { isRedNumber, ROULETTE_PAYOUT } from '@/lib/inco/payoutMath';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import { muiStyles } from './styles';

const theme = createTheme(muiStyles.dark);

// Authentic roulette table layout, 3 columns x 12 rows, bottom-to-top like a real table.
const ROWS = Array.from({ length: 12 }, (_, row) => [row * 3 + 3, row * 3 + 2, row * 3 + 1]).reverse();

function NumberCell({ n, active, isWinner, onClick }) {
  const bg = n === 0 ? 'game.green' : isRedNumber(n) ? 'game.red' : 'dark.bg';
  return (
    <Box
      onClick={() => onClick(n)}
      sx={{
        cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 44, fontWeight: 700, color: '#fff', bgcolor: bg,
        border: () => `2px solid ${active ? '#fff' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isWinner ? '0 0 0 3px #ffd54a, 0 0 18px rgba(255,213,74,0.7)' : 'none',
        transition: 'box-shadow .3s ease, border-color .15s ease', borderRadius: 1,
      }}
    >
      {n}
    </Box>
  );
}

function OutsideCell({ label, active, onClick, swatch }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        height: 48, borderRadius: 1, fontWeight: 700, color: '#fff', bgcolor: 'dark.card',
        border: () => `2px solid ${active ? '#fff' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {swatch && <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: swatch }} />}
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
    </Box>
  );
}

export default function RoulettePage() {
  const hook = useConfidentialGame('roulette');
  const [betType, setBetType] = useState(0);
  const [selection, setSelection] = useState(7);
  const [recentResults, setRecentResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const spinSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const chipSelectRef = useRef(null);

  const balance = useReadContract({
    address: usdcAddress, abi: usdcAbi, functionName: 'balanceOf',
    args: hook.address ? [hook.address] : undefined,
    query: { enabled: Boolean(hook.address), refetchInterval: 15_000 },
  });

  function pickStraight(n) {
    setBetType(0); setSelection(n);
    chipSelectRef.current?.play?.().catch(() => {});
  }
  function pickOutside(type, sel) {
    setBetType(type); setSelection(sel);
    chipSelectRef.current?.play?.().catch(() => {});
  }
  function play() {
    spinSoundRef.current?.play?.().catch(() => {});
    hook.play([betType, selection]);
  }

  useEffect(() => {
    if (hook.stage === 'done' && hook.outcome) {
      const n = Number(hook.outcome.winningNumber);
      setRecentResults((prev) => [n, ...prev].slice(0, 20));
      if (Number(hook.outcome.payout) > 0) winSoundRef.current?.play?.().catch(() => {});
    }
  }, [hook.stage, hook.outcome]);

  useEffect(() => {
    if (!hook.address) return;
    fetch(`/api/game-history?wallet=${hook.address}&game=roulette&limit=20`).then((r) => r.json()).then((j) => setHistory(j.history || [])).catch(() => {});
  }, [hook.address, hook.stage]);

  useEffect(() => {
    fetch('/api/leaderboard?game=roulette&limit=10').then((r) => r.json()).then((j) => setLeaderboard(j.leaderboard || [])).catch(() => {});
  }, [hook.stage]);

  const winningNumber = hook.stage === 'done' ? Number(hook.outcome?.winningNumber) : null;

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#080005', pt: { xs: 10, md: 12 }, pb: 10 }}>
        <audio ref={spinSoundRef} src="/sounds/ball-spin.mp3" preload="auto" />
        <audio ref={winSoundRef} src="/sounds/win-chips.mp3" preload="auto" />
        <audio ref={chipSelectRef} src="/sounds/chip-select.mp3" preload="auto" />

        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 0.5 }}>Confidential Roulette</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
            Inco Lightning seals the winning number until your wager is locked on Base Sepolia.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto', py: 1, mb: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2, gap: 1 }}>
            <Typography variant="body2" sx={{ mx: 1.5, whiteSpace: 'nowrap', color: '#fff', fontWeight: 700 }}>Recent:</Typography>
            {recentResults.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.8 }}>No spins yet</Typography>
            ) : recentResults.map((n, i) => (
              <Box key={i} sx={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0, bgcolor: n === 0 ? 'game.green' : isRedNumber(n) ? 'game.red' : 'dark.bg', border: '1px solid rgba(255,255,255,0.2)' }}>{n}</Box>
            ))}
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: { xs: 1.5, md: 2 }, overflowX: 'auto' }}>
                <Box sx={{ display: 'flex', gap: 0.5, minWidth: 560 }}>
                  <NumberCell n={0} active={betType === 0 && selection === 0} isWinner={winningNumber === 0} onClick={pickStraight} />
                  <Box sx={{ flex: 1, display: 'grid', gridTemplateRows: 'repeat(12, 1fr)', gap: 0.5 }}>
                    {ROWS.map((row, i) => (
                      <Box key={i} sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                        {row.map((n) => (
                          <NumberCell key={n} n={n} active={betType === 0 && selection === n} isWinner={winningNumber === n} onClick={pickStraight} />
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, mt: 0.5 }}>
                  {[2, 1, 0].map((col) => (
                    <OutsideCell key={col} label={`Column ${col + 1} (2:1)`} active={betType === 5 && selection === col} onClick={() => pickOutside(5, col)} />
                  ))}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, mt: 0.5 }}>
                  {['1st 12', '2nd 12', '3rd 12'].map((label, i) => (
                    <OutsideCell key={label} label={label} active={betType === 4 && selection === i} onClick={() => pickOutside(4, i)} />
                  ))}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5, mt: 0.5 }}>
                  <OutsideCell label="1–18" active={betType === 3 && selection === 0} onClick={() => pickOutside(3, 0)} />
                  <OutsideCell label="Even" active={betType === 2 && selection === 0} onClick={() => pickOutside(2, 0)} />
                  <OutsideCell label="Red" swatch="game.red" active={betType === 1 && selection === 0} onClick={() => pickOutside(1, 0)} />
                  <OutsideCell label="Black" swatch="dark.bg" active={betType === 1 && selection === 1} onClick={() => pickOutside(1, 1)} />
                  <OutsideCell label="Odd" active={betType === 2 && selection === 1} onClick={() => pickOutside(2, 1)} />
                  <OutsideCell label="19–36" active={betType === 3 && selection === 1} onClick={() => pickOutside(3, 1)} />
                </Box>
              </Box>

              <Box sx={{ mt: 3, bgcolor: 'dark.card', borderRadius: 2, p: 2.5 }}>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Strategy &amp; odds</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Straight number: {ROULETTE_PAYOUT.straight.toFixed(2)}× payout, 1-in-37 chance.</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Dozen / column: {ROULETTE_PAYOUT.dozenOrColumn.toFixed(2)}× payout, 12-in-37 chance.</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Red/black, odd/even, high/low: {ROULETTE_PAYOUT.evenMoney.toFixed(2)}× payout, 18-in-37 chance.</Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: 2.5, mb: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Your USDC balance</Typography>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 2 }}>
                  {balance.data != null ? (Number(balance.data) / 10 ** USDC_DECIMALS).toFixed(2) : '—'} USDC
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Wager (USDC)</Typography>
                <input className="game-input" type="number" min="0.1" max="10" step="0.1" value={hook.wager} onChange={(e) => hook.setWager(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
                {!hook.isConnected ? (
                  <ConnectWalletButton className="w-full" />
                ) : (
                  <button onClick={play} disabled={hook.busy} className="rounded-xl bg-white px-7 py-3 font-black text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-50 w-full">
                    {hook.stage === 'idle' || hook.stage === 'done' || hook.stage === 'error' ? 'Spin' : stageCopy[hook.stage]}
                  </button>
                )}
                {hook.error && <Typography variant="body2" sx={{ color: '#f87171', mt: 2 }}>{hook.error}</Typography>}
                {hook.outcome && (
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(20,216,84,0.1)', border: '1px solid rgba(20,216,84,0.3)' }}>
                    <Typography variant="body2" sx={{ color: '#14D854', fontWeight: 700 }}>Winning number: {String(hook.outcome.winningNumber)}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Payout: {hook.payout} USDC</Typography>
                    <a href={`https://sepolia.basescan.org/tx/${hook.settleHash}`} target="_blank" rel="noreferrer" style={{ color: '#14D854', fontSize: 12 }}>View settlement on BaseScan ↗</a>
                  </Box>
                )}
              </Box>

              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: 2.5, mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#f0abfc', fontWeight: 700, mb: 1 }}>Megapot progress</Typography>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>{hook.credits} <Typography component="span" sx={{ color: 'text.secondary', fontSize: 14 }}>/ 1000</Typography></Typography>
                <button
                  disabled={!hook.vaultConfigured || hook.credits < 1000 || hook.claimPending || hook.claimReceiptLoading}
                  onClick={() => hook.claim({ address: hook.rewardVaultAddress, abi: hook.rewardVaultAbi, functionName: 'claimTicket' })}
                  className="mt-3 w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-black disabled:opacity-40"
                >
                  {hook.claimPending || hook.claimReceiptLoading ? 'Claiming…' : 'Claim Megapot ticket'}
                </button>
              </Box>

              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: 2.5, mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Your history</Typography>
                {history.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>No rounds yet.</Typography>
                ) : history.map((h) => (
                  <Box key={h.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{h.result}</Typography>
                    <Typography variant="body2" sx={{ color: Number(h.payout_raw) > Number(h.bet_raw) ? '#14D854' : 'text.secondary' }}>{(Number(h.payout_raw) / 10 ** USDC_DECIMALS).toFixed(2)} USDC</Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: 2.5 }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Leaderboard</Typography>
                {leaderboard.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>No data yet.</Typography>
                ) : leaderboard.slice(0, 5).map((row) => (
                  <Box key={row.wallet} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>#{row.rank} {row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}</Typography>
                    <Typography variant="body2" sx={{ color: '#fff' }}>{(row.wagered / 10 ** USDC_DECIMALS).toFixed(2)} USDC</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
