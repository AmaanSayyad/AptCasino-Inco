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
///         into real Megapot ticket NFTs on Base Sepolia. Referral arrays stay empty.
contract MegapotRewardVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant CREDITS_PER_TICKET = 1_000;
    bytes32 public constant SOURCE = keccak256('APTCASINO');

    IERC20 public immutable usdc;
    IJackpot public immutable jackpot;
    IJackpotRandomTicketBuyer public immutable randomTicketBuyer;
    address public casino;
    bool public claimsPaused;

    mapping(address => uint256) public credits;

    event CasinoUpdated(address indexed casino);
    event CreditsAwarded(address indexed player, uint256 indexed gameId, uint8 kind, uint256 amount);
    event TicketClaimed(address indexed player, uint256 indexed ticketId, uint256 price);
    event ClaimsPaused(bool paused);

    error OnlyCasino();
    error ClaimsArePaused();
    error NotEnoughCredits();
    error VaultNeedsUsdc();

    constructor(address usdc_, address jackpot_, address randomTicketBuyer_) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
        jackpot = IJackpot(jackpot_);
        randomTicketBuyer = IJackpotRandomTicketBuyer(randomTicketBuyer_);
        usdc.forceApprove(randomTicketBuyer_, type(uint256).max);
    }

    function setCasino(address casino_) external onlyOwner {
        casino = casino_;
        emit CasinoUpdated(casino_);
    }

    function setClaimsPaused(bool paused) external onlyOwner {
        claimsPaused = paused;
        emit ClaimsPaused(paused);
    }

    function award(address player, uint256 gameId, uint8 kind, uint256 amount) external {
        if (msg.sender != casino) revert OnlyCasino();
        credits[player] += amount;
        emit CreditsAwarded(player, gameId, kind, amount);
    }

    function claimTicket() external nonReentrant returns (uint256 ticketId) {
        if (claimsPaused) revert ClaimsArePaused();
        if (credits[msg.sender] < CREDITS_PER_TICKET) revert NotEnoughCredits();
        uint256 price = jackpot.ticketPrice();
        if (usdc.balanceOf(address(this)) < price) revert VaultNeedsUsdc();

        credits[msg.sender] -= CREDITS_PER_TICKET;
        address[] memory noReferrers = new address[](0);
        uint256[] memory noSplit = new uint256[](0);
        uint256[] memory ticketIds = randomTicketBuyer.buyTickets(
            1,
            msg.sender,
            noReferrers,
            noSplit,
            SOURCE
        );
        ticketId = ticketIds[0];
        emit TicketClaimed(msg.sender, ticketId, price);
    }

    function withdrawUsdc(address to, uint256 amount) external onlyOwner {
        usdc.safeTransfer(to, amount);
    }
}
