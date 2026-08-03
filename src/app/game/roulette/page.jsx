'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useReadContract } from 'wagmi';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import BalanceChip from '@/components/treasury/BalanceChip';
import { useConfidentialGame, stageCopy } from '@/lib/inco/useConfidentialGame';
import { isRedNumber } from '@/lib/inco/payoutMath';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import { muiStyles } from './styles';
import RouletteHistory from './components/RouletteHistory';
import RouletteLeaderboard from './components/RouletteLeaderboard';
import StrategyGuide from './components/StrategyGuide';

const theme = createTheme(muiStyles.dark);
const CHIP_VALUES = [0.5, 1, 5, 10];

// Authentic roulette table layout, 3 columns x 12 rows, bottom-to-top like a real table.
const ROWS = Array.from({ length: 12 }, (_, row) => [row * 3 + 3, row * 3 + 2, row * 3 + 1]).reverse();

function betKey(betType, selection, numbers) {
  return betType === 6 ? `6:${[...numbers].sort((a, b) => a - b).join(',')}` : `${betType}:${selection}`;
}
const COVERED_SHAPES = {
  split: { label: 'Split', count: 2, payout: '18x' },
  street: { label: 'Street', count: 3, payout: '12x' },
  corner: { label: 'Corner', count: 4, payout: '9x' },
  sixline: { label: 'Six-line', count: 6, payout: '6x' },
};

function NumberCell({ n, chipAmount, isWinner, isPending, onClick }) {
  const bg = n === 0 ? 'game.green' : isRedNumber(n) ? 'game.red' : 'dark.bg';
  return (
    <Box
      onClick={() => onClick(n)}
      sx={{
        position: 'relative', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 44, fontWeight: 700, color: '#fff', bgcolor: bg,
        border: () => `2px solid ${isPending ? '#38bdf8' : chipAmount ? '#ffd54a' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isWinner ? '0 0 0 3px #ffd54a, 0 0 18px rgba(255,213,74,0.7)' : isPending ? '0 0 12px rgba(56,189,248,0.6)' : 'none',
        transition: 'box-shadow .3s ease, border-color .15s ease', borderRadius: 1,
      }}
    >
      {n}
      {chipAmount ? <Chip amount={chipAmount} /> : null}
    </Box>
  );
}

function OutsideCell({ label, chipAmount, onClick, swatch }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        height: 48, borderRadius: 1, fontWeight: 700, color: '#fff', bgcolor: 'dark.card',
        border: () => `2px solid ${chipAmount ? '#ffd54a' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {swatch && <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: swatch }} />}
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
      {chipAmount ? <Chip amount={chipAmount} /> : null}
    </Box>
  );
}

function Chip({ amount }) {
  return (
    <Box sx={{
      position: 'absolute', top: -8, right: -8, minWidth: 22, height: 22, borderRadius: '50%', px: 0.5,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
      bgcolor: '#ffd54a', color: '#1a1a1a', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    }}>
      {amount}
    </Box>
  );
}

export default function RoulettePage() {
  const hook = useConfidentialGame('roulette');
  // Multi-chip betting: several simultaneous (betType, selection, amount) bets in one
  // round, matching a real table — up to 10, the live contract's own limit.
  const [bets, setBets] = useState([]);
  const [chipValue, setChipValue] = useState(1);
  const [recentResults, setRecentResults] = useState([]);
  // Covered-numbers bets (split/street/corner/six-line): pick a shape, then click that
  // many numbers to define it — real betType 6 on-chain, 36/count odds, not a UI toy.
  const [betShape, setBetShape] = useState('straight');
  const [pendingNumbers, setPendingNumbers] = useState([]);

  const spinSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const chipSelectRef = useRef(null);

  const balance = useReadContract({
    address: usdcAddress, abi: usdcAbi, functionName: 'balanceOf',
    args: hook.address ? [hook.address] : undefined,
    query: { enabled: Boolean(hook.address), refetchInterval: 15_000 },
  });

  function placeChip(betType, selection, numbers = []) {
    chipSelectRef.current?.play?.().catch(() => {});
    setBets((current) => {
      const key = betKey(betType, selection, numbers);
      const existing = current.find((b) => betKey(b.betType, b.selection, b.numbers ?? []) === key);
      if (existing) {
        return current.map((b) => (betKey(b.betType, b.selection, b.numbers ?? []) === key ? { ...b, amount: b.amount + chipValue } : b));
      }
      if (current.length >= 10) return current; // contract caps at 10 bets/round
      return [...current, { betType, selection, numbers, amount: chipValue }];
    });
  }
  function clearBets() { setBets([]); setPendingNumbers([]); }
  function removeBet(betType, selection, numbers) {
    const key = betKey(betType, selection, numbers);
    setBets((current) => current.filter((b) => betKey(b.betType, b.selection, b.numbers ?? []) !== key));
  }
  function chipFor(betType, selection) {
    return bets.find((b) => b.betType === betType && b.selection === selection)?.amount ?? 0;
  }

  function handleNumberClick(n) {
    if (betShape === 'straight') {
      placeChip(0, n);
      return;
    }
    chipSelectRef.current?.play?.().catch(() => {});
    setPendingNumbers((current) => {
      const required = COVERED_SHAPES[betShape].count;
      const next = current.includes(n) ? current.filter((v) => v !== n) : [...current, n];
      if (next.length >= required) {
        placeChip(6, 0, next.slice(0, required));
        return [];
      }
      return next;
    });
  }

  const totalWager = bets.reduce((sum, b) => sum + b.amount, 0);

  async function play() {
    if (bets.length === 0) return;
    spinSoundRef.current?.play?.().catch(() => {});
    const response = hook.mode === 'treasury'
      ? await hook.playTreasury({ bets: bets.map((b) => ({ betType: b.betType, selection: b.selection, numbers: b.numbers ?? [], wagerRaw: Math.round(b.amount * 1_000_000) })) })
      : await hook.playBets(bets.map((b) => ({ betType: b.betType, selection: b.selection, numbers: b.numbers ?? [], amount: String(b.amount) })));
    if (response) setBets([]);
  }

  useEffect(() => {
    if (hook.stage === 'done' && hook.outcome) {
      const n = Number(hook.outcome.winningNumber);
      setRecentResults((prev) => [n, ...prev].slice(0, 20));
      if (Number(hook.outcome.payout) > 0) winSoundRef.current?.play?.().catch(() => {});
    }
  }, [hook.stage, hook.outcome]);

  const winningNumber = hook.stage === 'done' ? Number(hook.outcome?.winningNumber) : null;

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#080005', pt: { xs: 10, md: 12 }, pb: 10 }}>
        <audio ref={spinSoundRef} src="/sounds/ball-spin.mp3" preload="auto" />
        <audio ref={winSoundRef} src="/sounds/win-chips.mp3" preload="auto" />
        <audio ref={chipSelectRef} src="/sounds/chip-select.mp3" preload="auto" />

        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 0.5 }}>Confidential Roulette</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
            Inco Lightning seals the winning number until your wagers are locked on Base Sepolia. Place multiple chips, then spin.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <BalanceChip treasury={hook.treasury} />
            <button type="button" onClick={() => hook.setMode(hook.mode === 'treasury' ? 'wallet' : 'treasury')} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textDecoration: 'underline dotted' }}>
              {hook.mode === 'treasury' ? 'Play from wallet instead' : 'Play from house balance instead'}
            </button>
          </Box>

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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Chip:</Typography>
                {CHIP_VALUES.map((v) => (
                  <Box key={v} onClick={() => setChipValue(v)} sx={{ cursor: 'pointer', px: 1.5, py: 0.5, borderRadius: 999, fontWeight: 700, fontSize: 13, bgcolor: chipValue === v ? '#ffd54a' : 'rgba(255,255,255,0.06)', color: chipValue === v ? '#1a1a1a' : '#fff' }}>{v}</Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total: <b style={{ color: '#fff' }}>{totalWager.toFixed(2)} USDC</b></Typography>
                {bets.length > 0 && <button type="button" onClick={clearBets} style={{ fontSize: 12, color: '#f87171' }}>Clear</button>}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Bet type:</Typography>
                {[['straight', 'Straight (36x)'], ...Object.entries(COVERED_SHAPES).map(([key, s]) => [key, `${s.label} (${s.payout})`])].map(([key, label]) => (
                  <Box key={key} onClick={() => { setBetShape(key); setPendingNumbers([]); }} sx={{ cursor: 'pointer', px: 1.5, py: 0.5, borderRadius: 999, fontWeight: 700, fontSize: 12, bgcolor: betShape === key ? '#38bdf8' : 'rgba(255,255,255,0.06)', color: betShape === key ? '#0a1a1f' : '#fff' }}>{label}</Box>
                ))}
                {betShape !== 'straight' && (
                  <Typography variant="body2" sx={{ color: '#38bdf8', fontSize: 12 }}>
                    Click {COVERED_SHAPES[betShape].count} numbers ({pendingNumbers.length}/{COVERED_SHAPES[betShape].count} selected)
                  </Typography>
                )}
              </Box>

              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: { xs: 1.5, md: 2 }, overflowX: 'auto' }}>
                <Box sx={{ display: 'flex', gap: 0.5, minWidth: 560 }}>
                  <NumberCell n={0} chipAmount={chipFor(0, 0)} isWinner={winningNumber === 0} isPending={pendingNumbers.includes(0)} onClick={handleNumberClick} />
                  <Box sx={{ flex: 1, display: 'grid', gridTemplateRows: 'repeat(12, 1fr)', gap: 0.5 }}>
                    {ROWS.map((row, i) => (
                      <Box key={i} sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                        {row.map((n) => (
                          <NumberCell key={n} n={n} chipAmount={chipFor(0, n)} isWinner={winningNumber === n} isPending={pendingNumbers.includes(n)} onClick={handleNumberClick} />
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, mt: 0.5 }}>
                  {[2, 1, 0].map((col) => (
                    <OutsideCell key={col} label={`Column ${col + 1} (2:1)`} chipAmount={chipFor(5, col)} onClick={() => placeChip(5, col)} />
                  ))}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, mt: 0.5 }}>
                  {['1st 12', '2nd 12', '3rd 12'].map((label, i) => (
                    <OutsideCell key={label} label={label} chipAmount={chipFor(4, i)} onClick={() => placeChip(4, i)} />
                  ))}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5, mt: 0.5 }}>
                  <OutsideCell label="1–18" chipAmount={chipFor(3, 0)} onClick={() => placeChip(3, 0)} />
                  <OutsideCell label="Even" chipAmount={chipFor(2, 0)} onClick={() => placeChip(2, 0)} />
                  <OutsideCell label="Red" swatch="game.red" chipAmount={chipFor(1, 0)} onClick={() => placeChip(1, 0)} />
                  <OutsideCell label="Black" swatch="dark.bg" chipAmount={chipFor(1, 1)} onClick={() => placeChip(1, 1)} />
                  <OutsideCell label="Odd" chipAmount={chipFor(2, 1)} onClick={() => placeChip(2, 1)} />
                  <OutsideCell label="19–36" chipAmount={chipFor(3, 1)} onClick={() => placeChip(3, 1)} />
                </Box>

                {bets.some((b) => b.betType === 6) && (
                  <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {bets.filter((b) => b.betType === 6).map((b) => (
                      <Box key={betKey(6, 0, b.numbers)} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 999, px: 1.25, py: 0.5, fontSize: 12 }}>
                        <Typography variant="body2" sx={{ fontSize: 12, color: '#38bdf8', fontWeight: 700 }}>{b.numbers.length === 2 ? 'Split' : b.numbers.length === 3 ? 'Street' : b.numbers.length === 4 ? 'Corner' : 'Six-line'}</Typography>
                        <Typography variant="body2" sx={{ fontSize: 12, color: '#fff' }}>{b.numbers.join('-')}</Typography>
                        <Typography variant="body2" sx={{ fontSize: 12, color: '#ffd54a', fontWeight: 700 }}>{b.amount}</Typography>
                        <button type="button" onClick={() => removeBet(6, 0, b.numbers)} style={{ color: '#f87171', fontSize: 12, lineHeight: 1 }}>×</button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <StrategyGuide />
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: 2.5, mb: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Your USDC balance</Typography>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 2 }}>
                  {balance.data != null ? (Number(balance.data) / 10 ** USDC_DECIMALS).toFixed(2) : '—'} USDC
                </Typography>
                {!hook.isConnected ? (
                  <ConnectWalletButton className="w-full" />
                ) : (
                  <button onClick={play} disabled={hook.busy || bets.length === 0} className="rounded-xl bg-white px-7 py-3 font-black text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-50 w-full">
                    {hook.stage === 'idle' || hook.stage === 'done' || hook.stage === 'error' ? `Spin (${bets.length} bet${bets.length === 1 ? '' : 's'})` : stageCopy[hook.stage]}
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

              <RouletteHistory address={hook.address} stage={hook.stage} />
              <RouletteLeaderboard stage={hook.stage} />
            </Grid>
          </Grid>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
