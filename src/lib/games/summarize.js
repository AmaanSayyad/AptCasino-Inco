/** Short human-readable outcome summary for history rows, shared by direct-wallet and treasury play paths. */
export function summarizeOutcome(game, outcomeArgs) {
  if (game === 'roulette') return `Landed on ${outcomeArgs.winningNumber}`;
  if (game === 'wheel') return `Segment ${outcomeArgs.segment} · ${(Number(outcomeArgs.multiplierBps) / 10_000).toFixed(2)}x`;
  if (game === 'plinko') return `Bucket ${outcomeArgs.bucket} · ${(Number(outcomeArgs.multiplierBps) / 10_000).toFixed(2)}x`;
  return outcomeArgs.hitMine ? 'Hit a mine' : 'Cleared the board';
}
