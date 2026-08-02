// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {euint256, e, inco} from '@inco/lightning/src/Lib.sol';
import {DecryptionAttestation} from '@inco/lightning/src/lightning-parts/DecryptionAttester.types.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

interface IMegapotRewardVault {
    function award(address player, uint256 gameId, uint8 kind, uint256 amount) external;
}

/// @title AptCasino
/// @notice Four confidential Base games powered by Inco Lightning. Wagers and payouts
///         are USDC; the small fixed ETH fee attached to each call only covers Inco's
///         covalidator cost and is unrelated to the wager currency.
/// @dev Every round is play -> attested reveal -> settle. The secret seed cannot
///      be read or front-run while the wager is pending.
contract AptCasino is Ownable {
    using e for *;
    using SafeERC20 for IERC20;

    enum Kind { Roulette, Wheel, Plinko, Mines }

    /// @dev USDC has 6 decimals: 10_000_000 = 10 USDC.
    uint256 public constant MAX_WAGER = 10_000_000;
    uint256 public constant GAME_TIMEOUT = 20 minutes;
    IERC20 public immutable usdc;
    uint256 public totalActiveLiability;
    uint256 public nextGameId = 1;
    IMegapotRewardVault public rewardVault;

    struct PendingGame {
        address player;
        uint256 wager;
        uint256 maxPayout;
        euint256 seed;
        uint64 createdAt;
        bool settled;
        Kind kind;
        bytes params;
    }

    mapping(uint256 => PendingGame) private games;
    uint8 private entered = 1;

    event BankrollFunded(address indexed from, uint256 amount);
    event RewardVaultUpdated(address indexed vault);
    event RewardAwardFailed(uint256 indexed gameId, address indexed player, uint256 credits);
    event BetPlaced(uint256 indexed gameId, address indexed player, uint256 wager, bytes32 seedHandle, uint8 kind);
    event BetSettled(uint256 indexed gameId, address indexed player, uint256 wager, uint256 payout, uint8 kind);
    event BetExpired(uint256 indexed gameId, address indexed player, uint256 refund);
    event RouletteOutcome(uint256 indexed gameId, uint8 winningNumber, uint256 payout);
    event WheelOutcome(uint256 indexed gameId, uint8 segment, uint256 multiplierBps, uint256 payout);
    event PlinkoOutcome(uint256 indexed gameId, uint8 bucket, uint256 multiplierBps, uint256 payout);
    event MinesOutcome(uint256 indexed gameId, bool hitMine, uint8[] minePositions, uint256 payout);

    error InvalidInput();
    error InvalidWager();
    error InsufficientValue();
    error InsufficientBankroll();
    error UnknownGame();
    error AlreadySettled();
    error HandleMismatch();
    error InvalidAttestation();
    error NotExpired();
    error ExceedsAvailable();

    modifier nonReentrant() {
        require(entered == 1, 'reentrant');
        entered = 2;
        _;
        entered = 1;
    }

    constructor(address usdc_) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
    }

    function getFee() external view returns (uint256) { return inco.getFee(); }

    function setRewardVault(address vault) external onlyOwner {
        rewardVault = IMegapotRewardVault(vault);
        emit RewardVaultUpdated(vault);
    }

    function getGame(uint256 gameId) external view returns (PendingGame memory) { return games[gameId]; }

    function availableBankroll() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance > totalActiveLiability ? balance - totalActiveLiability : 0;
    }

    /// @notice Anyone can top up the USDC bankroll that backs player payouts.
    function depositBankroll(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BankrollFunded(msg.sender, amount);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount > availableBankroll()) revert ExceedsAvailable();
        usdc.safeTransfer(owner(), amount);
    }

    function _validateWager(uint256 wager) private pure {
        if (wager == 0 || wager > MAX_WAGER) revert InvalidWager();
    }

    function _open(uint256 wager, uint256 maxPayout, Kind kind, bytes memory params)
        private returns (uint256 gameId)
    {
        _validateWager(wager);
        if (msg.value < inco.getFee()) revert InsufficientValue();
        usdc.safeTransferFrom(msg.sender, address(this), wager);

        euint256 seed = e.rand();
        e.allowThis(seed);
        e.reveal(seed);

        if (usdc.balanceOf(address(this)) < totalActiveLiability + maxPayout) revert InsufficientBankroll();
        totalActiveLiability += maxPayout;
        gameId = nextGameId++;
        games[gameId] = PendingGame({
            player: msg.sender,
            wager: wager,
            maxPayout: maxPayout,
            seed: seed,
            createdAt: uint64(block.timestamp),
            settled: false,
            kind: kind,
            params: params
        });
        emit BetPlaced(gameId, msg.sender, wager, euint256.unwrap(seed), uint8(kind));
    }

    struct RouletteBet { uint8 betType; uint8 selection; uint256 wager; }

    /// @notice Places up to 10 simultaneous chips in one round (straight/color/parity/
    ///         high-low/dozen/column), matching a real roulette table. Each chip's own
    ///         wager funds its own payout; the round's total wager is the sum of chips.
    function playRoulette(RouletteBet[] calldata bets)
        external payable nonReentrant returns (uint256 gameId)
    {
        if (bets.length == 0 || bets.length > 10) revert InvalidInput();
        uint256 totalWager;
        uint256 totalMaxPayout;
        for (uint256 i; i < bets.length; i++) {
            RouletteBet calldata bet = bets[i];
            if (bet.wager == 0) revert InvalidInput();
            if (bet.betType > 5) revert InvalidInput();
            if (bet.betType == 0 && bet.selection > 36) revert InvalidInput();
            if ((bet.betType >= 1 && bet.betType <= 3) && bet.selection > 1) revert InvalidInput();
            if ((bet.betType == 4 || bet.betType == 5) && bet.selection > 2) revert InvalidInput();
            totalWager += bet.wager;
            totalMaxPayout += _rouletteMaxPayout(bet.betType, bet.wager);
        }
        gameId = _open(totalWager, totalMaxPayout, Kind.Roulette, abi.encode(bets));
    }

    function _rouletteMaxPayout(uint8 betType, uint256 wager) private pure returns (uint256) {
        return betType == 0 ? (wager * 36 * 97) / 100 :
            (betType >= 4 ? (wager * 3 * 97) / 100 : (wager * 2 * 97) / 100);
    }

    function playWheel(uint8 risk, uint8 segments, uint256 wager)
        external payable nonReentrant returns (uint256 gameId)
    {
        if (risk > 2 || (segments != 10 && segments != 20 && segments != 30 && segments != 40)) revert InvalidInput();
        gameId = _open(wager, wager * 10, Kind.Wheel, abi.encode(risk, segments));
    }

    function playPlinko(uint8 risk, uint8 rows, uint256 wager)
        external payable nonReentrant returns (uint256 gameId)
    {
        if (risk > 2 || rows < 8 || rows > 16) revert InvalidInput();
        gameId = _open(wager, wager * 16, Kind.Plinko, abi.encode(risk, rows));
    }

    function playMines(uint8[] calldata selectedTiles, uint8 mineCount, uint256 wager)
        external payable nonReentrant returns (uint256 gameId)
    {
        if (mineCount == 0 || mineCount > 10 || selectedTiles.length == 0 || selectedTiles.length > 10) revert InvalidInput();
        if (selectedTiles.length + mineCount > 25) revert InvalidInput();
        for (uint256 i; i < selectedTiles.length; i++) {
            if (selectedTiles[i] >= 25) revert InvalidInput();
            for (uint256 j; j < i; j++) if (selectedTiles[i] == selectedTiles[j]) revert InvalidInput();
        }
        uint256 maxPayout = _minesPayout(wager, mineCount, uint8(selectedTiles.length));
        gameId = _open(wager, maxPayout, Kind.Mines, abi.encode(selectedTiles, mineCount));
    }

    function settle(uint256 gameId, DecryptionAttestation calldata attestation, bytes[] calldata signatures)
        external nonReentrant
    {
        PendingGame storage game = games[gameId];
        if (game.player == address(0)) revert UnknownGame();
        if (game.settled) revert AlreadySettled();
        if (attestation.handle != euint256.unwrap(game.seed)) revert HandleMismatch();
        if (!inco.incoVerifier().isValidDecryptionAttestation(attestation, signatures)) revert InvalidAttestation();

        game.settled = true;
        totalActiveLiability -= game.maxPayout;
        uint256 seed = uint256(attestation.value);
        uint256 payout;
        if (game.kind == Kind.Roulette) payout = _settleRoulette(gameId, game, seed);
        else if (game.kind == Kind.Wheel) payout = _settleWheel(gameId, game, seed);
        else if (game.kind == Kind.Plinko) payout = _settlePlinko(gameId, game, seed);
        else payout = _settleMines(gameId, game, seed);

        if (payout > game.maxPayout) payout = game.maxPayout;
        if (payout > 0) usdc.safeTransfer(game.player, payout);
        emit BetSettled(gameId, game.player, game.wager, payout, uint8(game.kind));
        _award(gameId, game, payout);
    }

    function expireGame(uint256 gameId) external nonReentrant {
        PendingGame storage game = games[gameId];
        if (game.player == address(0)) revert UnknownGame();
        if (game.settled) revert AlreadySettled();
        if (block.timestamp < game.createdAt + GAME_TIMEOUT) revert NotExpired();
        game.settled = true;
        totalActiveLiability -= game.maxPayout;
        usdc.safeTransfer(game.player, game.wager);
        emit BetExpired(gameId, game.player, game.wager);
    }

    function _settleRoulette(uint256 gameId, PendingGame storage game, uint256 seed) private returns (uint256 payout) {
        RouletteBet[] memory bets = abi.decode(game.params, (RouletteBet[]));
        uint8 winning = uint8(seed % 37);
        for (uint256 i; i < bets.length; i++) {
            RouletteBet memory bet = bets[i];
            bool won;
            if (bet.betType == 0) won = winning == bet.selection;
            else if (bet.betType == 1) won = winning > 0 && _isRed(winning) == (bet.selection == 0);
            else if (bet.betType == 2) won = winning > 0 && winning % 2 == bet.selection;
            else if (bet.betType == 3) won = winning > 0 && (winning > 18 ? 1 : 0) == bet.selection;
            else if (bet.betType == 4) won = winning > 0 && uint8((winning - 1) / 12) == bet.selection;
            else won = winning > 0 && uint8((winning - 1) % 3) == bet.selection;
            if (won) payout += _rouletteMaxPayout(bet.betType, bet.wager);
        }
        emit RouletteOutcome(gameId, winning, payout);
    }

    function _settleWheel(uint256 gameId, PendingGame storage game, uint256 seed) private returns (uint256 payout) {
        (uint8 risk, uint8 segments) = abi.decode(game.params, (uint8, uint8));
        uint8 segment = uint8(seed % segments);
        uint256 multiplierBps = _wheelMultiplier(risk, segment, segments);
        payout = (game.wager * multiplierBps) / 10_000;
        emit WheelOutcome(gameId, segment, multiplierBps, payout);
    }

    function _settlePlinko(uint256 gameId, PendingGame storage game, uint256 seed) private returns (uint256 payout) {
        (uint8 risk, uint8 rows) = abi.decode(game.params, (uint8, uint8));
        uint8 rights;
        for (uint8 i; i < rows; i++) rights += uint8((seed >> i) & 1);
        uint256 multiplierBps = _plinkoMultiplier(risk, rows, rights);
        payout = (game.wager * multiplierBps) / 10_000;
        emit PlinkoOutcome(gameId, rights, multiplierBps, payout);
    }

    function _settleMines(uint256 gameId, PendingGame storage game, uint256 seed) private returns (uint256 payout) {
        (uint8[] memory selected, uint8 mineCount) = abi.decode(game.params, (uint8[], uint8));
        uint8[] memory pool = new uint8[](25);
        for (uint8 i; i < 25; i++) pool[i] = i;
        uint8[] memory minePositions = new uint8[](mineCount);
        for (uint8 i; i < mineCount; i++) {
            uint256 j = i + (uint256(keccak256(abi.encode(seed, i))) % (25 - i));
            (pool[i], pool[j]) = (pool[j], pool[i]);
            minePositions[i] = pool[i];
        }
        bool hit;
        for (uint256 i; i < selected.length && !hit; i++) {
            for (uint256 j; j < minePositions.length; j++) if (selected[i] == minePositions[j]) { hit = true; break; }
        }
        if (!hit) payout = _minesPayout(game.wager, mineCount, uint8(selected.length));
        emit MinesOutcome(gameId, hit, minePositions, payout);
    }

    function _minesPayout(uint256 wager, uint8 mines, uint8 picks) private pure returns (uint256) {
        uint256 numerator = 1;
        uint256 denominator = 1;
        for (uint8 i; i < picks; i++) {
            numerator *= 25 - i;
            denominator *= 25 - mines - i;
        }
        return (wager * numerator * 97) / (denominator * 100);
    }

    function _wheelMultiplier(uint8 risk, uint8 segment, uint8 segments) private pure returns (uint256) {
        uint8 lane = uint8((uint256(segment) * 10) / segments);
        if (risk == 0) return lane < 2 ? 20_000 : lane < 6 ? 11_000 : lane < 9 ? 8_000 : 0;
        if (risk == 1) return lane == 0 ? 50_000 : lane < 3 ? 20_000 : lane < 7 ? 7_500 : 0;
        return lane == 0 ? 100_000 : lane < 2 ? 30_000 : lane < 5 ? 5_000 : 0;
    }

    function _plinkoMultiplier(uint8 risk, uint8 rows, uint8 bucket) private pure returns (uint256) {
        uint8 center = rows / 2;
        uint8 distance = bucket > center ? bucket - center : center - bucket;
        if (risk == 0) return distance >= center ? 40_000 : distance + 1 >= center ? 20_000 : distance >= 2 ? 11_000 : 7_000;
        if (risk == 1) return distance >= center ? 80_000 : distance + 1 >= center ? 30_000 : distance >= 2 ? 8_000 : 3_500;
        return distance >= center ? 160_000 : distance + 1 >= center ? 50_000 : distance >= 2 ? 5_000 : 1_000;
    }

    function _isRed(uint8 n) private pure returns (bool) {
        return n == 1 || n == 3 || n == 5 || n == 7 || n == 9 || n == 12 || n == 14 || n == 16 || n == 18 ||
            n == 19 || n == 21 || n == 23 || n == 25 || n == 27 || n == 30 || n == 32 || n == 34 || n == 36;
    }

    function _award(uint256 gameId, PendingGame storage game, uint256 payout) private {
        if (address(rewardVault) == address(0)) return;
        // ponytail: wager is 6-decimal USDC; /1e4 maps ~0.01 USDC to 1 credit.
        // Tuning knob — adjust the divisor/clamp if credit accrual feels off.
        uint256 amount = game.wager / 1e4;
        if (amount < 10) amount = 10;
        if (amount > 250) amount = 250;
        if (payout > game.wager) amount += 50;
        try rewardVault.award(game.player, gameId, uint8(game.kind), amount) {} catch {
            emit RewardAwardFailed(gameId, game.player, amount);
        }
    }
}
