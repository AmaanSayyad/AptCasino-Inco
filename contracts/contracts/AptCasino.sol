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
/// @dev Roulette/Wheel/Plinko are play -> attested reveal -> settle (one round trip).
///      Mines is a longer-lived session: start -> attested reveal commits the mine
///      layout into private storage (not emitted anywhere) -> the player reveals tiles
///      one at a time (revealTile) or locks in the current multiplier (cashOut). Every
///      mine layout is still genuinely Inco-attested randomness — the board just isn't
///      shown all at once, matching a real incremental Mines game.
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

    struct MinesSession {
        address player;
        uint256 wager;
        uint256 reservedLiability;
        uint8 mineCount;
        uint8 revealedCount;
        bool committed;
        bool active;
        euint256 seed;
        uint64 createdAt;
        uint8[] minePositions;
        bool[25] revealed;
    }

    mapping(uint256 => PendingGame) private games;
    mapping(uint256 => MinesSession) private minesSessions;
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
    event MinesCommitted(uint256 indexed gameId);
    event MinesTileRevealed(uint256 indexed gameId, uint8 tile, uint8 revealedCount);
    event MinesBusted(uint256 indexed gameId, uint8 tile, uint8[] minePositions);
    event MinesCashedOut(uint256 indexed gameId, uint256 payout, uint8 revealedCount, uint8[] minePositions);

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
    error SessionNotFound();
    error SessionNotActive();
    error AlreadyCommitted();
    error NotCommitted();
    error TileAlreadyRevealed();
    error NothingToCashOut();

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

    /// @dev Deliberately omits minePositions/revealed — do not add a getter that returns
    ///      them while a session might still be active, that would defeat the point.
    function getMinesSession(uint256 gameId) external view returns (
        address player, uint256 wager, uint8 mineCount, uint8 revealedCount, bool committed, bool active
    ) {
        MinesSession storage s = minesSessions[gameId];
        return (s.player, s.wager, s.mineCount, s.revealedCount, s.committed, s.active);
    }

    function isTileRevealed(uint256 gameId, uint8 tile) external view returns (bool) {
        return minesSessions[gameId].revealed[tile];
    }

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

    function _lockWagerAndSeed(uint256 wager) private returns (euint256 seed) {
        _validateWager(wager);
        if (msg.value < inco.getFee()) revert InsufficientValue();
        usdc.safeTransferFrom(msg.sender, address(this), wager);
        seed = e.rand();
        e.allowThis(seed);
        e.reveal(seed);
    }

    function _reserveLiability(uint256 maxPayout) private {
        if (usdc.balanceOf(address(this)) < totalActiveLiability + maxPayout) revert InsufficientBankroll();
        totalActiveLiability += maxPayout;
    }

    function _open(uint256 wager, uint256 maxPayout, Kind kind, bytes memory params)
        private returns (uint256 gameId)
    {
        euint256 seed = _lockWagerAndSeed(wager);
        _reserveLiability(maxPayout);
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

    struct RouletteBet { uint8 betType; uint8 selection; uint8[] numbers; uint256 wager; }

    /// @notice Places up to 10 simultaneous chips in one round, matching a real table:
    ///         straight/color/parity/high-low/dozen/column (betType 0-5), or a custom
    ///         split/street/corner/six-line covering 2, 3, 4, or 6 numbers (betType 6,
    ///         via `numbers` — odds are 36/count regardless of table position, so exact
    ///         adjacency isn't validated on-chain). Each chip's own wager funds its own
    ///         payout; the round's total wager is the sum of chips.
    function playRoulette(RouletteBet[] calldata bets)
        external payable nonReentrant returns (uint256 gameId)
    {
        if (bets.length == 0 || bets.length > 10) revert InvalidInput();
        uint256 totalWager;
        uint256 totalMaxPayout;
        for (uint256 i; i < bets.length; i++) {
            RouletteBet calldata bet = bets[i];
            if (bet.wager == 0) revert InvalidInput();
            if (bet.betType > 6) revert InvalidInput();
            if (bet.betType == 0 && bet.selection > 36) revert InvalidInput();
            if ((bet.betType >= 1 && bet.betType <= 3) && bet.selection > 1) revert InvalidInput();
            if ((bet.betType == 4 || bet.betType == 5) && bet.selection > 2) revert InvalidInput();
            if (bet.betType == 6) {
                uint256 n = bet.numbers.length;
                if (n != 2 && n != 3 && n != 4 && n != 6) revert InvalidInput();
                for (uint256 j; j < n; j++) {
                    if (bet.numbers[j] > 36) revert InvalidInput();
                    for (uint256 k; k < j; k++) if (bet.numbers[j] == bet.numbers[k]) revert InvalidInput();
                }
            }
            totalWager += bet.wager;
            totalMaxPayout += _rouletteMaxPayout(bet);
        }
        gameId = _open(totalWager, totalMaxPayout, Kind.Roulette, abi.encode(bets));
    }

    function _rouletteMaxPayout(RouletteBet memory bet) private pure returns (uint256) {
        if (bet.betType == 0) return (bet.wager * 36 * 97) / 100;
        if (bet.betType == 6) return (bet.wager * (36 / bet.numbers.length) * 97) / 100;
        return bet.betType >= 4 ? (bet.wager * 3 * 97) / 100 : (bet.wager * 2 * 97) / 100;
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

    /// @notice Starts an incremental Mines session: locks the wager, commits an Inco
    ///         seed. Call commitMines once the attested reveal is ready, then revealTile
    ///         per click, then cashOut whenever (or let a reveal end the session by
    ///         hitting a mine). Liability is reserved incrementally per reveal (see
    ///         revealTile) rather than for the full-clear worst case up front — that
    ///         worst case is combinatorially enormous (e.g. C(25,5) ≈ 53,000x at 5
    ///         mines) and would make every bankroll size look insufficient. A deep
    ///         session can still hit a real bankroll ceiling; revealTile reverts with
    ///         InsufficientBankroll if so, same as any other casino's max-win limit.
    function startMines(uint8 mineCount, uint256 wager) external payable nonReentrant returns (uint256 gameId) {
        if (mineCount == 0 || mineCount > 24) revert InvalidInput();
        euint256 seed = _lockWagerAndSeed(wager);
        uint256 maxPayout = _minesPayout(wager, mineCount, 1);
        _reserveLiability(maxPayout);

        gameId = nextGameId++;
        MinesSession storage session = minesSessions[gameId];
        session.player = msg.sender;
        session.wager = wager;
        session.reservedLiability = maxPayout;
        session.mineCount = mineCount;
        session.seed = seed;
        session.createdAt = uint64(block.timestamp);
        session.active = true;

        emit BetPlaced(gameId, msg.sender, wager, euint256.unwrap(seed), uint8(Kind.Mines));
    }

    function commitMines(uint256 gameId, DecryptionAttestation calldata attestation, bytes[] calldata signatures)
        external nonReentrant
    {
        MinesSession storage session = minesSessions[gameId];
        if (session.player == address(0)) revert SessionNotFound();
        if (session.committed) revert AlreadyCommitted();
        if (attestation.handle != euint256.unwrap(session.seed)) revert HandleMismatch();
        if (!inco.incoVerifier().isValidDecryptionAttestation(attestation, signatures)) revert InvalidAttestation();

        uint256 seed = uint256(attestation.value);
        uint8 mineCount = session.mineCount;
        uint8[] memory pool = new uint8[](25);
        for (uint8 i; i < 25; i++) pool[i] = i;
        uint8[] memory minePositions = new uint8[](mineCount);
        for (uint8 i; i < mineCount; i++) {
            uint256 j = i + (uint256(keccak256(abi.encode(seed, i))) % (25 - i));
            (pool[i], pool[j]) = (pool[j], pool[i]);
            minePositions[i] = pool[i];
        }
        session.minePositions = minePositions;
        session.committed = true;
        emit MinesCommitted(gameId);
    }

    function revealTile(uint256 gameId, uint8 tile) external nonReentrant returns (bool hitMine) {
        return _revealTile(gameId, tile);
    }

    /// @notice Reveal multiple safe tiles in one tx (stops early if a mine is hit).
    ///         Cuts Mines UX latency when the player (or treasury) wants multi-pick.
    function revealTiles(uint256 gameId, uint8[] calldata tiles) external nonReentrant returns (bool hitMine) {
        if (tiles.length == 0 || tiles.length > 24) revert InvalidInput();
        for (uint256 i; i < tiles.length; i++) {
            hitMine = _revealTile(gameId, tiles[i]);
            if (hitMine) return true;
        }
    }

    function _revealTile(uint256 gameId, uint8 tile) private returns (bool hitMine) {
        MinesSession storage session = minesSessions[gameId];
        if (session.player != msg.sender) revert SessionNotFound();
        if (!session.committed) revert NotCommitted();
        if (!session.active) revert SessionNotActive();
        if (tile >= 25) revert InvalidInput();
        if (session.revealed[tile]) revert TileAlreadyRevealed();

        // Grow the reservation just enough to cover a win at the next depth, checked
        // against the bankroll fresh each time (see startMines for why it's incremental).
        uint256 projectedPayout = _minesPayout(session.wager, session.mineCount, session.revealedCount + 1);
        if (projectedPayout > session.reservedLiability) {
            uint256 additionalLiability = projectedPayout - session.reservedLiability;
            if (usdc.balanceOf(address(this)) < totalActiveLiability + additionalLiability) revert InsufficientBankroll();
            totalActiveLiability += additionalLiability;
            session.reservedLiability = projectedPayout;
        }

        session.revealed[tile] = true;
        hitMine = _isMine(session, tile);
        if (hitMine) {
            session.active = false;
            totalActiveLiability -= session.reservedLiability;
            emit MinesBusted(gameId, tile, session.minePositions);
            emit BetSettled(gameId, session.player, session.wager, 0, uint8(Kind.Mines));
            _award(gameId, session.player, session.wager, 0, Kind.Mines);
        } else {
            session.revealedCount += 1;
            emit MinesTileRevealed(gameId, tile, session.revealedCount);
        }
    }

    function cashOut(uint256 gameId) external nonReentrant returns (uint256 payout) {
        MinesSession storage session = minesSessions[gameId];
        if (session.player != msg.sender) revert SessionNotFound();
        if (!session.active) revert SessionNotActive();
        if (session.revealedCount == 0) revert NothingToCashOut();

        payout = _minesPayout(session.wager, session.mineCount, session.revealedCount);
        session.active = false;
        totalActiveLiability -= session.reservedLiability;
        if (payout > 0) usdc.safeTransfer(session.player, payout);
        emit MinesCashedOut(gameId, payout, session.revealedCount, session.minePositions);
        emit BetSettled(gameId, session.player, session.wager, payout, uint8(Kind.Mines));
        _award(gameId, session.player, session.wager, payout, Kind.Mines);
    }

    /// @notice Refunds a Mines session that was never committed (Inco reveal never
    ///         landed) after the timeout. A committed-but-abandoned session's funds stay
    ///         locked rather than auto-refunded — out of scope for this pass.
    function expireMines(uint256 gameId) external nonReentrant {
        MinesSession storage session = minesSessions[gameId];
        if (session.player == address(0)) revert SessionNotFound();
        if (session.committed) revert AlreadyCommitted();
        if (!session.active) revert SessionNotActive();
        if (block.timestamp < session.createdAt + GAME_TIMEOUT) revert NotExpired();
        session.active = false;
        totalActiveLiability -= session.reservedLiability;
        usdc.safeTransfer(session.player, session.wager);
        emit BetExpired(gameId, session.player, session.wager);
    }

    function _isMine(MinesSession storage session, uint8 tile) private view returns (bool) {
        uint8[] storage positions = session.minePositions;
        for (uint256 i; i < positions.length; i++) if (positions[i] == tile) return true;
        return false;
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
        else payout = _settlePlinko(gameId, game, seed);

        if (payout > game.maxPayout) payout = game.maxPayout;
        if (payout > 0) usdc.safeTransfer(game.player, payout);
        emit BetSettled(gameId, game.player, game.wager, payout, uint8(game.kind));
        _award(gameId, game.player, game.wager, payout, game.kind);
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
            else if (bet.betType == 5) won = winning > 0 && uint8((winning - 1) % 3) == bet.selection;
            else { for (uint256 j; j < bet.numbers.length; j++) if (bet.numbers[j] == winning) { won = true; break; } }
            if (won) payout += _rouletteMaxPayout(bet);
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

    function _award(uint256 gameId, address player, uint256 wager, uint256 payout, Kind kind) private {
        if (address(rewardVault) == address(0)) return;
        // ponytail: wager is 6-decimal USDC; /1e4 maps ~0.01 USDC to 1 credit.
        // Tuning knob — adjust the divisor/clamp if credit accrual feels off.
        uint256 amount = wager / 1e4;
        if (amount < 10) amount = 10;
        if (amount > 250) amount = 250;
        if (payout > wager) amount += 50;
        try rewardVault.award(player, gameId, uint8(kind), amount) {} catch {
            emit RewardAwardFailed(gameId, player, amount);
        }
    }
}
