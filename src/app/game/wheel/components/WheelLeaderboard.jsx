'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Avatar, Chip } from '@mui/material';
import { FaTrophy } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';

/** Faithful port of the original leaderboard card, fed by /api/leaderboard?game=wheel (real, live). */
const WheelLeaderboard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard?game=wheel&limit=10')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setRows(j.leaderboard || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Paper elevation={5} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: 'linear-gradient(135deg, rgba(9, 0, 5, 0.9) 0%, rgba(25, 5, 30, 0.85) 100%)', backdropFilter: 'blur(15px)', border: '1px solid rgba(104, 29, 219, 0.2)' }}>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, color: 'white' }}>
        <FaTrophy color="#FFA500" />
        Wheel Leaderboard
      </Typography>

      {loading ? (
        <Typography color="rgba(255,255,255,0.5)" sx={{ py: 4, textAlign: 'center' }}>Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography color="rgba(255,255,255,0.5)" sx={{ py: 4, textAlign: 'center' }}>No wheel rounds recorded yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map((row) => (
            <a key={row.wallet} href={basescanUrl('address', row.wallet)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', '&:hover': { borderColor: 'rgba(255,165,0,0.4)' } }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: row.rank === 1 ? '#FFA500' : row.rank === 2 ? '#C0C0C0' : row.rank === 3 ? '#CD7F32' : '#333947' }}>{row.rank}</Avatar>
                <Typography color="white" sx={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}>{row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}</Typography>
                <Chip
                  size="small"
                  label={`${Number(row.wagered || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC wagered`}
                  sx={{ bgcolor: 'rgba(104,29,219,0.15)', color: '#a78bfa' }}
                />
                <Chip
                  size="small"
                  label={`${Number(row.biggestWin || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC best`}
                  sx={{ bgcolor: 'rgba(20,216,84,0.15)', color: '#14D854' }}
                />
              </Box>
            </a>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default WheelLeaderboard;
