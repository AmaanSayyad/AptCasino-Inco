'use client';

import React, { useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Pagination } from '@mui/material';
import { FaHistory, FaExternalLinkAlt } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';

const PAGE_SIZE = 10;

/** Faithful port of the original bet-history table, fed by /api/game-history (real, live). */
const WheelHistory = ({ gameHistory = [] }) => {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(gameHistory.length / PAGE_SIZE));
  const rows = gameHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Paper elevation={5} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: 'linear-gradient(135deg, rgba(9, 0, 5, 0.9) 0%, rgba(25, 5, 30, 0.85) 100%)', backdropFilter: 'blur(15px)', border: '1px solid rgba(104, 29, 219, 0.2)' }}>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, color: 'white' }}>
        <FaHistory color="#FFA500" />
        Your Wheel History
      </Typography>

      {rows.length === 0 ? (
        <Typography color="rgba(255,255,255,0.5)" sx={{ py: 4, textAlign: 'center' }}>No rounds played yet.</Typography>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Time', 'Bet', 'Payout', 'Proof'].map((h) => (
                    <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const won = Number(row.payout_raw || 0) > Number(row.bet_raw || 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.08)' }}>{new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.08)' }}>{Number(row.bet_raw).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC</TableCell>
                      <TableCell sx={{ color: won ? '#14D854' : 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>{won ? '+' : ''}{Number(row.payout_raw).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC</TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        {row.proof_reference && (
                          <a href={basescanUrl('tx', row.proof_reference)} target="_blank" rel="noreferrer" style={{ color: '#681DDB', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Verify <FaExternalLinkAlt size={10} />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {pageCount > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination count={pageCount} page={page} onChange={(_, v) => setPage(v)} color="secondary" size="small" />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default WheelHistory;
