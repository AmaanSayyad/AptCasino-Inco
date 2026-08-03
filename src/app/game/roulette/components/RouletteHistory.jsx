'use client';

import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';

export default function RouletteHistory({ address, stage }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/game-history?wallet=${address}&game=roulette&limit=20`).then((r) => r.json()).then((j) => setHistory(j.history || [])).catch(() => {});
  }, [address, stage]);

  return (
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
  );
}
