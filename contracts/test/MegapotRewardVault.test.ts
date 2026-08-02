import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('MegapotRewardVault', function () {
  it('awards credits only from the casino and buys a zero-referral ticket', async function () {
    const [owner, casino, player] = await ethers.getSigners();
    const Usdc = await ethers.getContractFactory('TestUSDC');
    const usdc = await Usdc.deploy();
    const Jackpot = await ethers.getContractFactory('TestJackpot');
    const jackpot = await Jackpot.deploy();
    const Buyer = await ethers.getContractFactory('TestRandomTicketBuyer');
    const buyer = await Buyer.deploy(await usdc.getAddress());
    const Vault = await ethers.getContractFactory('MegapotRewardVault');
    const vault = await Vault.deploy(await usdc.getAddress(), await jackpot.getAddress(), await buyer.getAddress());

    await vault.setCasino(casino.address);
    await expect(vault.award(player.address, 1, 0, 1000)).to.be.revertedWithCustomError(vault, 'OnlyCasino');
    await (vault.connect(casino) as any).award(player.address, 1, 0, 1000);
    await usdc.mint(await vault.getAddress(), 1_000_000);
    await expect((vault.connect(player) as any).claimTicket()).to.emit(vault, 'TicketClaimed').withArgs(player.address, 1, 1_000_000);
    expect(await buyer.lastRecipient()).to.equal(player.address);
    expect(await buyer.lastReferrerCount()).to.equal(0);
    expect(await vault.credits(player.address)).to.equal(0);
    expect(await usdc.balanceOf(await buyer.getAddress())).to.equal(1_000_000);
    expect(await vault.owner()).to.equal(owner.address);
  });
});
