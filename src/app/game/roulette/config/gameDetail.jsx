export const gameData = {
  title: 'European Roulette',
  label: 'CLASSIC CASINO GAME',
  image: '/images/games/roulette.png',
  youtube: '6nKBlWaRI8w', // European Roulette Tutorial Video ID
  paragraphs: [
    'Step into the world of European Roulette, where fortune favors the bold and every spin could change your fate. Our provably fair, Inco-confidential roulette combines classic casino elegance with cutting-edge on-chain technology.',
    'With a single zero and a house edge of just 2.70% (plus a small 3% contract fee), our European Roulette offers better odds than traditional American Roulette variants. The wheel features 37 pockets (numbers 0-36), creating the perfect balance of risk and reward for both beginners and seasoned players.',
    'Place your bets on individual numbers, colors, odds/evens, dozens, or splits/streets/corners/six-lines and watch as Inco Lightning seals the winning number until every wager is locked. Will you play it safe with outside bets or chase the thrill of a 35:1 payout on a straight-up number?',
    'Every round settles on Base Sepolia with a real, attested Inco reveal — no fabricated fairness claims, just a verifiable settlement transaction you can check yourself.',
  ],
};

export const bettingTableData = {
  title: 'Betting Options',
  description: 'Explore our comprehensive betting options and maximize your winning potential:',
  options: [
    {
      category: 'Inside Bets',
      bets: [
        { name: 'Straight Up', description: 'Bet on a single number', payout: '35:1' },
        { name: 'Split', description: 'Bet on two adjacent numbers', payout: '17:1' },
        { name: 'Street', description: 'Bet on three numbers in a row', payout: '11:1' },
        { name: 'Corner', description: 'Bet on four numbers in a square', payout: '8:1' },
        { name: 'Six Line', description: 'Bet on six numbers in two rows', payout: '5:1' },
      ],
    },
    {
      category: 'Outside Bets',
      bets: [
        { name: 'Dozen', description: '12 consecutive numbers', payout: '2:1' },
        { name: 'Column', description: '12 numbers (vertical)', payout: '2:1' },
        { name: 'Red/Black', description: 'All red or black numbers', payout: '1:1' },
        { name: 'Odd/Even', description: 'All odd or even numbers', payout: '1:1' },
        { name: 'High/Low', description: 'Numbers 1-18 or 19-36', payout: '1:1' },
      ],
    },
  ],
};
