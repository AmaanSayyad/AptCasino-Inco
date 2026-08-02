'use client';

import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Tooltip, Stack, Fade } from '@mui/material';
import { FaChartPie, FaInfoCircle, FaDice, FaPercentage } from 'react-icons/fa';
import { buildExpandedWheelSegments } from '@/lib/wheel/wheelSegments';

const RISKS = ['low', 'medium', 'high'];
const SEGMENT_OPTIONS = [10, 20, 30, 40];

/**
 * Static odds table, but the numbers are the wheel's REAL current multipliers
 * (read from the same buildExpandedWheelSegments the wheel itself renders
 * from, which mirrors the live AptCasino.sol contract) instead of the
 * original's hardcoded "Stake.com" reference numbers.
 */
const WheelProbability = () => {
  const [risk, setRisk] = useState('medium');
  const [segments, setSegments] = useState(20);

  const rows = useMemo(() => {
    const wheel = buildExpandedWheelSegments(risk, segments);
    const byMultiplier = new Map();
    wheel.forEach((s) => {
      const key = s.multiplier;
      byMultiplier.set(key, (byMultiplier.get(key) || 0) + 1);
    });
    return [...byMultiplier.entries()]
      .map(([multiplier, count]) => ({ multiplier, count, probability: count / wheel.length }))
      .sort((a, b) => b.multiplier - a.multiplier);
  }, [risk, segments]);

  return (
    <Paper elevation={5} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: 'linear-gradient(135deg, rgba(9, 0, 5, 0.9) 0%, rgba(25, 5, 30, 0.85) 100%)', backdropFilter: 'blur(15px)', border: '1px solid rgba(104, 29, 219, 0.2)', mb: 5, height: '100%' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ borderBottom: '1px solid rgba(104, 29, 219, 0.3)', pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, color: 'white' }}>
        <FaChartPie color="#FFA500" size={20} />
        <span style={{ background: 'linear-gradient(90deg, #FFFFFF, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Win Probabilities</span>
      </Typography>
      <Typography variant="body2" color="rgba(255,255,255,0.7)" sx={{ mb: 2 }}>
        Live odds for the connected wallet's wheel, read straight from the contract's payout math — not a marketing estimate.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {RISKS.map((r) => (
          <Button key={r} size="small" variant={risk === r ? 'contained' : 'outlined'} onClick={() => setRisk(r)} sx={{ textTransform: 'capitalize', borderColor: 'rgba(255,255,255,0.2)', color: risk === r ? '#0A0009' : 'white', bgcolor: risk === r ? '#FFA500' : 'transparent' }}>{r}</Button>
        ))}
        <Box sx={{ flex: 1 }} />
        {SEGMENT_OPTIONS.map((n) => (
          <Button key={n} size="small" variant={segments === n ? 'contained' : 'outlined'} onClick={() => setSegments(n)} sx={{ minWidth: 0, borderColor: 'rgba(255,255,255,0.2)', color: segments === n ? '#0A0009' : 'white', bgcolor: segments === n ? '#681DDB' : 'transparent' }}>{n}</Button>
        ))}
      </Stack>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((row) => (
          <Fade in key={row.multiplier}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FaDice color={row.multiplier === 0 ? '#666' : '#14D854'} />
                <Typography color="white" fontWeight={600}>{row.multiplier.toFixed(2)}x</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="rgba(255,255,255,0.6)">{row.count} of {segments} segments</Typography>
                <Tooltip title="Probability of landing on this multiplier tier">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,165,0,0.15)' }}>
                    <FaPercentage size={10} color="#FFA500" />
                    <Typography variant="body2" color="#FFA500" fontWeight={600}>{(row.probability * 100).toFixed(1)}%</Typography>
                  </Box>
                </Tooltip>
              </Box>
            </Box>
          </Fade>
        ))}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(104, 29, 219, 0.1)', border: '1px solid rgba(104, 29, 219, 0.2)' }}>
        <FaInfoCircle color="#681DDB" style={{ marginTop: 3, flexShrink: 0 }} />
        <Typography variant="body2" color="rgba(255,255,255,0.75)">
          More segments spread the same tiers thinner, but the multiplier tiers themselves only depend on risk level — this matches exactly what AptCasino.sol pays out.
        </Typography>
      </Box>
    </Paper>
  );
};

export default WheelProbability;
