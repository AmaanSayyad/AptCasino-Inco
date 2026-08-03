'use client';

import React, { useState } from 'react';
import { Box, Typography, Paper, Button, Tooltip, Stack } from '@mui/material';
import { FaChartPie, FaInfoCircle, FaThumbsUp, FaDice, FaQuestion, FaChevronRight } from 'react-icons/fa';
import Grid from '@mui/material/Unstable_Grid2';
import { ROULETTE_PAYOUT, rouletteCoveredPayout } from '@/lib/inco/payoutMath';

const fmt = (n) => `${n.toFixed(2)}×`;

/** Odds recomputed from the live contract's payout math, not the original's numbers. */
const probabilityData = [
  { type: 'Red/Black', probability: 48.6, odds: fmt(ROULETTE_PAYOUT.evenMoney), color: '#d82633' },
  { type: 'Odd/Even', probability: 48.6, odds: fmt(ROULETTE_PAYOUT.evenMoney), color: '#681DDB' },
  { type: 'High/Low', probability: 48.6, odds: fmt(ROULETTE_PAYOUT.evenMoney), color: '#7209B7' },
  { type: 'Dozens', probability: 32.4, odds: fmt(ROULETTE_PAYOUT.dozenOrColumn), color: '#4361EE' },
  { type: 'Columns', probability: 32.4, odds: fmt(ROULETTE_PAYOUT.dozenOrColumn), color: '#4CC9F0' },
  { type: 'Six Line', probability: 16.2, odds: fmt(rouletteCoveredPayout(6)), color: '#F72585' },
  { type: 'Corner', probability: 10.8, odds: fmt(rouletteCoveredPayout(4)), color: '#3A0CA3' },
  { type: 'Street', probability: 8.1, odds: fmt(rouletteCoveredPayout(3)), color: '#4895EF' },
  { type: 'Split', probability: 5.4, odds: fmt(rouletteCoveredPayout(2)), color: '#F94144' },
  { type: 'Straight Up', probability: 2.7, odds: fmt(ROULETTE_PAYOUT.straight), color: '#14D854' },
];

export default function WinProbabilities() {
  const [sortBy, setSortBy] = useState('probability');

  const sortedData = [...probabilityData].sort((a, b) => (
    sortBy === 'probability' ? b.probability - a.probability : parseFloat(b.odds) - parseFloat(a.odds)
  ));

  return (
    <Paper
      elevation={5}
      sx={{
        p: { xs: 2, md: 3 }, borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(9, 0, 5, 0.9) 0%, rgba(25, 5, 30, 0.85) 100%)',
        backdropFilter: 'blur(15px)', border: '1px solid rgba(104, 29, 219, 0.2)',
        position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', height: '100%',
        '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '100%', height: '5px', background: 'linear-gradient(90deg, #681DDB, #14D854)' },
      }}
    >
      <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ borderBottom: '1px solid rgba(104, 29, 219, 0.3)', pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
        <FaChartPie color="#681DDB" size={22} />
        <span style={{ background: 'linear-gradient(90deg, #FFFFFF, #14D854)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Win Probabilities</span>
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="rgba(255,255,255,0.7)">Visual guide to win chances in European Roulette</Typography>
        <Stack direction="row" spacing={1} sx={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '20px', padding: '2px', border: '1px solid rgba(104, 29, 219, 0.2)' }}>
          {[['probability', 'By Chance'], ['odds', 'By Payout']].map(([id, label]) => (
            <Button key={id} size="small" onClick={() => setSortBy(id)} sx={{ fontSize: '0.75rem', color: sortBy === id ? 'white' : 'rgba(255,255,255,0.6)', backgroundColor: sortBy === id ? 'rgba(104, 29, 219, 0.3)' : 'transparent', borderRadius: '18px', minWidth: 'auto', p: 0.5, px: 1.5 }}>
              {label}
            </Button>
          ))}
        </Stack>
      </Box>

      <Grid container spacing={1.5}>
        {sortedData.map((item) => (
            <Grid xs={12} sm={6} md={6} key={item.type}>
              <Box sx={{
                p: 2, borderRadius: 2, border: `1px solid ${item.color}40`, position: 'relative', height: '100%', overflow: 'hidden',
                background: `linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(${parseInt(item.color.slice(1, 3), 16)}, ${parseInt(item.color.slice(3, 5), 16)}, ${parseInt(item.color.slice(5, 7), 16)}, 0.05) 100%)`,
                '&::after': { content: '""', position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}` },
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" color="white" sx={{ mb: 0.5 }}>{item.type}</Typography>
                    <Typography variant="body2" color="rgba(255,255,255,0.7)"><span style={{ color: '#d82633', fontWeight: 'bold' }}>{item.odds}</span> payout multiplier</Typography>
                  </Box>
                  <Tooltip title={<Typography variant="body2">{BET_DESCRIPTIONS[item.type]}</Typography>} arrow placement="top">
                    <Box sx={{ cursor: 'help', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <FaInfoCircle color="rgba(255,255,255,0.6)" size={14} />
                    </Box>
                  </Tooltip>
                </Box>

                <Box sx={{ position: 'relative', mt: 2, mb: 1 }}>
                  <Box sx={{ height: '12px', width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
                    <Box sx={{ height: '100%', width: `${item.probability}%`, background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`, borderRadius: '6px', boxShadow: `0 0 10px ${item.color}80` }} />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${item.color}80` }}>
                        <FaDice color={item.color} size={16} />
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="white" sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{item.probability}%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {item.probability > 40 && <FaThumbsUp color="#14D854" />}
                      {item.probability > 15 && item.probability <= 40 && <FaThumbsUp color="#FFA500" />}
                      {item.probability <= 15 && <FaQuestion color="#d82633" />}
                      <Typography variant="body2" fontWeight="medium" color={item.probability > 40 ? '#14D854' : item.probability > 15 ? '#FFA500' : '#d82633'}>
                        {item.probability > 40 ? 'Best odds' : item.probability > 15 ? 'Medium odds' : 'High reward'}
                      </Typography>
                    </Box>
                    <FaChevronRight color="rgba(255,255,255,0.4)" size={14} />
                  </Box>
                </Box>
              </Box>
            </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 3, p: 2, borderRadius: 2, background: 'linear-gradient(135deg, rgba(104, 29, 219, 0.05) 0%, rgba(104, 29, 219, 0.15) 100%)', border: '1px solid rgba(104, 29, 219, 0.15)' }}>
        <FaInfoCircle color="#681DDB" style={{ flexShrink: 0 }} />
        <Typography variant="body2" color="rgba(255,255,255,0.8)">
          Higher probability bets offer more frequent wins but lower payouts. Riskier bets have higher rewards but less chance of winning.
        </Typography>
      </Box>
    </Paper>
  );
}

const BET_DESCRIPTIONS = {
  'Red/Black': 'Bet on all red or black numbers.',
  'Odd/Even': 'Bet on all odd or even numbers.',
  'High/Low': 'Bet on numbers 1-18 or 19-36.',
  Dozens: 'Bet on a group of 12 numbers (1-12, 13-24, or 25-36).',
  Columns: 'Bet on a vertical column of 12 numbers.',
  'Six Line': 'Bet on six numbers across two adjacent rows.',
  Corner: 'Bet on four numbers forming a square.',
  Street: 'Bet on three consecutive numbers in a row.',
  Split: 'Bet on two adjacent numbers.',
  'Straight Up': 'Bet on a single number.',
};
