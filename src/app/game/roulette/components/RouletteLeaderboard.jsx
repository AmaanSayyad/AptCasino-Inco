'use client';

import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';

export default function RouletteLeaderboard({ stage }) {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard?game=roulette&limit=10').then((r) => r.json()).then((j) => setLeaderboard(j.leaderboard || [])).catch(() => {});
  }, [stage]);

  return (
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
  );
}
