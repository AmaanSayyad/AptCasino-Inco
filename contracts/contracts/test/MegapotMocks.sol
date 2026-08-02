// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestUSDC is ERC20 {
    constructor() ERC20('Test USDC', 'USDC') {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract TestJackpot {
    uint256 public ticketPrice = 1_000_000;
}

contract TestRandomTicketBuyer {
    ERC20 public immutable usdc;
    uint256 public nextTicketId = 1;
    address public lastRecipient;
    uint256 public lastReferrerCount;

    constructor(address usdc_) { usdc = ERC20(usdc_); }

    function buyTickets(uint256 count, address recipient, address[] calldata referrers, uint256[] calldata, bytes32)
        external returns (uint256[] memory ticketIds)
    {
        usdc.transferFrom(msg.sender, address(this), count * 1_000_000);
        lastRecipient = recipient;
        lastReferrerCount = referrers.length;
        ticketIds = new uint256[](count);
        for (uint256 i; i < count; i++) ticketIds[i] = nextTicketId++;
    }
}
