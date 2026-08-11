// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

interface IJackpot {
    function ticketPrice() external view returns (uint256);
}

interface IJackpotRandomTicketBuyer {
    function buyTickets(
        uint256 count,
        address recipient,
        address[] calldata referrers,
        uint256[] calldata referralSplit,
        bytes32 source
    ) external returns (uint256[] memory ticketIds);
}

/// @notice Testnet reward treasury. AptCasino rounds earn credits; credits redeem
///         into real Megapot ticket NFTs on Base Sepolia with on-chain referrers.
contract MegapotRewardVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant CREDITS_PER_TICKET = 1_000;
    uint256 public constant ONE = 1e18;
    uint256 public constant PLATFORM_SPLIT = 7e17; // 70%
    uint256 public constant INVITER_SPLIT = 3e17; // 30%
    bytes32 public constant SOURCE = keccak256('APTCASINO');

    IERC20 public immutable usdc;
    IJackpot public immutable jackpot;
    IJackpotRandomTicketBuyer public immutable randomTicketBuyer;
    address public casino;
    /// @dev The custodial treasury signer. AptCasino records `msg.sender` (the treasury,
    ///      for house-balance rounds) as the credited player, so credits for those rounds
    ///      pool under the treasury's own address rather than the real end user's. The
    ///      operator claims tickets out of that pool on a real player's behalf — the
    ///      backend is trusted to only do so once its own per-user ledger shows that
    ///      player genuinely earned 1000 credits, the same trust already placed in it for
    ///      the off-chain USDC balance ledger.
    address public operator;
    /// @dev Always included as a Megapot referrer on ticket buys (integrator revenue).
    address public platformReferrer;
    bool public claimsPaused;

    mapping(address => uint256) public credits;

    event CasinoUpdated(address indexed casino);
    event OperatorUpdated(address indexed operator);
    event PlatformReferrerUpdated(address indexed referrer);
    event CreditsAwarded(address indexed player, uint256 indexed gameId, uint8 kind, uint256 amount);
    event TicketClaimed(address indexed player, uint256 indexed ticketId, uint256 price);
    event ClaimsPaused(bool paused);

    error OnlyCasino();
    error OnlyOperator();
    error ClaimsArePaused();
    error NotEnoughCredits();
    error VaultNeedsUsdc();

    constructor(address usdc_, address jackpot_, address randomTicketBuyer_) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
        jackpot = IJackpot(jackpot_);
        randomTicketBuyer = IJackpotRandomTicketBuyer(randomTicketBuyer_);
        usdc.forceApprove(randomTicketBuyer_, type(uint256).max);
        platformReferrer = msg.sender;
    }

    function setCasino(address casino_) external onlyOwner {
        casino = casino_;
        emit CasinoUpdated(casino_);
    }

    function setClaimsPaused(bool paused) external onlyOwner {
        claimsPaused = paused;
        emit ClaimsPaused(paused);
    }

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setPlatformReferrer(address referrer_) external onlyOwner {
        platformReferrer = referrer_;
        emit PlatformReferrerUpdated(referrer_);
    }

    function award(address player, uint256 gameId, uint8 kind, uint256 amount) external {
        if (msg.sender != casino) revert OnlyCasino();
        credits[player] += amount;
        emit CreditsAwarded(player, gameId, kind, amount);
    }

    function claimTicket() external nonReentrant returns (uint256 ticketId) {
        return _claimTicket(msg.sender, msg.sender, address(0));
    }

    /// @notice Same as claimTicket but attributes a secondary Megapot referrer (inviter).
    function claimTicketWithInviter(address inviter) external nonReentrant returns (uint256 ticketId) {
        return _claimTicket(msg.sender, msg.sender, inviter);
    }

    /// @notice Operator-only: spends 1000 credits out of the OPERATOR's own pooled
    ///         balance and sends the resulting ticket to `player`. Pass `address(0)`
    ///         for inviter when there is no secondary referrer (platform-only split).
    function claimTicketFor(address player, address inviter) external nonReentrant returns (uint256 ticketId) {
        if (msg.sender != operator) revert OnlyOperator();
        return _claimTicket(msg.sender, player, inviter);
    }

    function _claimTicket(address from, address recipient, address inviter) private returns (uint256 ticketId) {
        if (claimsPaused) revert ClaimsArePaused();
        if (credits[from] < CREDITS_PER_TICKET) revert NotEnoughCredits();
        uint256 price = jackpot.ticketPrice();
        if (usdc.balanceOf(address(this)) < price) revert VaultNeedsUsdc();

        credits[from] -= CREDITS_PER_TICKET;

        (address[] memory referrers, uint256[] memory split) = _buildReferrers(recipient, inviter);
        uint256[] memory ticketIds = randomTicketBuyer.buyTickets(1, recipient, referrers, split, SOURCE);
        ticketId = ticketIds[0];
        emit TicketClaimed(recipient, ticketId, price);
    }

    /// @dev Platform always earns when configured. Inviter gets 30% when distinct.
    function _buildReferrers(address recipient, address inviter)
        private
        view
        returns (address[] memory referrers, uint256[] memory split)
    {
        address platform = platformReferrer;
        bool hasPlatform = platform != address(0);
        bool hasInviter = inviter != address(0) && inviter != recipient && inviter != platform;

        if (hasPlatform && hasInviter) {
            referrers = new address[](2);
            split = new uint256[](2);
            referrers[0] = platform;
            referrers[1] = inviter;
            split[0] = PLATFORM_SPLIT;
            split[1] = INVITER_SPLIT;
            return (referrers, split);
        }
        if (hasPlatform) {
            referrers = new address[](1);
            split = new uint256[](1);
            referrers[0] = platform;
            split[0] = ONE;
            return (referrers, split);
        }
        if (hasInviter) {
            referrers = new address[](1);
            split = new uint256[](1);
            referrers[0] = inviter;
            split[0] = ONE;
            return (referrers, split);
        }
        referrers = new address[](0);
        split = new uint256[](0);
    }

    function withdrawUsdc(address to, uint256 amount) external onlyOwner {
        usdc.safeTransfer(to, amount);
    }
}
