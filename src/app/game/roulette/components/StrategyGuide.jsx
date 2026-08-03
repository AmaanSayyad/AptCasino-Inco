'use client';

import { Box, Typography } from '@mui/material';
import { ROULETTE_PAYOUT } from '@/lib/inco/payoutMath';

/** Odds recomputed from the live contract's payout math, not the original's stale numbers. */
export default function StrategyGuide() {
  return (
    <Box sx={{ mt: 3, bgcolor: 'dark.card', borderRadius: 2, p: 2.5 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Strategy &amp; odds</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Straight number: {ROULETTE_PAYOUT.straight.toFixed(2)}× payout, 1-in-37 chance.</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Dozen / column: {ROULETTE_PAYOUT.dozenOrColumn.toFixed(2)}× payout, 12-in-37 chance.</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Red/black, odd/even, high/low: {ROULETTE_PAYOUT.evenMoney.toFixed(2)}× payout, 18-in-37 chance.</Typography>
    </Box>
  );
}
