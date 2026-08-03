/** Roulette help copy — structured for Tutorial / Odds panels. */

export const ROULETTE_VARIANT = {
  title: 'European roulette',
  tagline: 'Single zero (0) — better player odds than double-zero tables',
};

export const ROULETTE_TUTORIAL_STEPS = [
  {
    step: 1,
    title: 'Fund your house balance (or play from wallet)',
    body: 'Deposit USDC once from the balance chip and play with zero signatures per round, or switch to "play from wallet" to sign each round yourself.',
    icon: 'wallet',
  },
  {
    step: 2,
    title: 'Set chip size',
    body: 'Tap a quick chip (0.5, 1, 5, 10 USDC). This is the stake applied each time you click a spot on the table.',
    icon: 'chip',
  },
  {
    step: 3,
    title: 'Place bets on the board',
    body: 'Click numbers, or pick Split/Street/Corner/Six-line and click the required numbers to define that covered bet. Stack up to 10 bets in one round — watch the total before spinning.',
    icon: 'board',
  },
  {
    step: 4,
    title: 'Spin & settle',
    body: 'Hit Spin when your bets are ready. Inco Lightning seals the winning number, then a real attested settlement transaction pays out any winning bets.',
    icon: 'spin',
  },
];

export const ROULETTE_TUTORIAL_TIPS = [
  'Use Clear to reset the whole board before spinning.',
  'You can stack multiple bet types in one round — watch the running total before spinning.',
];

export const rouletteOdds = [
  'Below are the supported inside bets',
  '-Straight Up (35:1 payout): Select one number',
  '-Split (17:1 payout): Select two numbers',
  '-Street (11:1 payout): Select three numbers in a row',
  '-Corner (8:1 payout): Select four numbers in a square',
  '-Six Line (5:1 payout): Select six numbers across two rows',
  'Below are the supported outside bets',
  '-Column (2:1 payout): 12 numbers aligned to a column',
  '-Dozen (2:1 payout): 12 numbers aligned to 1st, 2nd, or 3rd 12',
  '-Red/Black (1:1 payout): Bet on color',
  '-High/Low (1:1 payout): 1-18 or 19-36',
  '-Even/Odd (1:1 payout): Even or odd numbers',
];

export const ROULETTE_ODDS_HIGHLIGHTS = [
  { label: 'Straight up', payout: '35:1', color: '#14D854' },
  { label: 'Red / Black', payout: '1:1', color: '#d82633' },
  { label: 'Dozen / Column', payout: '2:1', color: '#681DDB' },
];
