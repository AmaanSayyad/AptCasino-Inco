import { parseAbi } from 'viem';
import { CASINO_ADDRESS, REWARD_VAULT_ADDRESS } from '@/lib/baseSepolia';

export const aptCasinoAddress = CASINO_ADDRESS;
export const rewardVaultAddress = REWARD_VAULT_ADDRESS;

export const aptCasinoAbi = parseAbi([
  'function getFee() view returns (uint256)',
  'function playRoulette(uint8 betType, uint8 selection, uint256 wager) payable returns (uint256 gameId)',
  'function playWheel(uint8 risk, uint8 segments, uint256 wager) payable returns (uint256 gameId)',
  'function playPlinko(uint8 risk, uint8 rows, uint256 wager) payable returns (uint256 gameId)',
  'function playMines(uint8[] selectedTiles, uint8 mineCount, uint256 wager) payable returns (uint256 gameId)',
  'function settle(uint256 gameId, (bytes32 handle, bytes32 value) attestation, bytes[] signatures)',
  'event BetPlaced(uint256 indexed gameId, address indexed player, uint256 wager, bytes32 seedHandle, uint8 kind)',
  'event BetSettled(uint256 indexed gameId, address indexed player, uint256 wager, uint256 payout, uint8 kind)',
  'event RouletteOutcome(uint256 indexed gameId, uint8 winningNumber, uint256 payout)',
  'event WheelOutcome(uint256 indexed gameId, uint8 segment, uint256 multiplierBps, uint256 payout)',
  'event PlinkoOutcome(uint256 indexed gameId, uint8 bucket, uint256 multiplierBps, uint256 payout)',
  'event MinesOutcome(uint256 indexed gameId, bool hitMine, uint8[] minePositions, uint256 payout)',
]);

export const rewardVaultAbi = parseAbi([
  'function credits(address player) view returns (uint256)',
  'function CREDITS_PER_TICKET() view returns (uint256)',
  'function claimTicket() returns (uint256 ticketId)',
  'event TicketClaimed(address indexed player, uint256 indexed ticketId, uint256 price)',
]);
