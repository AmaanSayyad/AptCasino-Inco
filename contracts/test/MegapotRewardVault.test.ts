import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('MegapotRewardVault', function () {
  it('awards credits only from the casino and buys a platform-referred ticket', async function () {
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
    expect(await buyer.lastReferrerCount()).to.equal(1);
    expect(await vault.credits(player.address)).to.equal(0);
    expect(await usdc.balanceOf(await buyer.getAddress())).to.equal(1_000_000);
    expect(await vault.owner()).to.equal(owner.address);
  });

  it('splits referrers between platform and inviter', async function () {
    const [, casino, player, inviter] = await ethers.getSigners();
    const Usdc = await ethers.getContractFactory('TestUSDC');
    const usdc = await Usdc.deploy();
    const Jackpot = await ethers.getContractFactory('TestJackpot');
    const jackpot = await Jackpot.deploy();
    const Buyer = await ethers.getContractFactory('TestRandomTicketBuyer');
    const buyer = await Buyer.deploy(await usdc.getAddress());
    const Vault = await ethers.getContractFactory('MegapotRewardVault');
    const vault = await Vault.deploy(await usdc.getAddress(), await jackpot.getAddress(), await buyer.getAddress());

    await vault.setCasino(casino.address);
    await (vault.connect(casino) as any).award(player.address, 1, 0, 1000);
    await usdc.mint(await vault.getAddress(), 1_000_000);
    await (vault.connect(player) as any).claimTicketWithInviter(inviter.address);
    expect(await buyer.lastReferrerCount()).to.equal(2);
  });

  it('lets the operator claim a ticket for another player out of its own credit pool', async function () {
    const [, casino, treasury, realPlayer, stranger] = await ethers.getSigners();
    const Usdc = await ethers.getContractFactory('TestUSDC');
    const usdc = await Usdc.deploy();
    const Jackpot = await ethers.getContractFactory('TestJackpot');
    const jackpot = await Jackpot.deploy();
    const Buyer = await ethers.getContractFactory('TestRandomTicketBuyer');
    const buyer = await Buyer.deploy(await usdc.getAddress());
    const Vault = await ethers.getContractFactory('MegapotRewardVault');
    const vault = await Vault.deploy(await usdc.getAddress(), await jackpot.getAddress(), await buyer.getAddress());

    await vault.setCasino(casino.address);
    await usdc.mint(await vault.getAddress(), 1_000_000);

    await (vault.connect(casino) as any).award(treasury.address, 1, 0, 1000);

    const zero = ethers.ZeroAddress;
    await expect((vault.connect(treasury) as any).claimTicketFor(realPlayer.address, zero))
      .to.be.revertedWithCustomError(vault, 'OnlyOperator');

    await vault.setOperator(treasury.address);
    await expect((vault.connect(stranger) as any).claimTicketFor(realPlayer.address, zero))
      .to.be.revertedWithCustomError(vault, 'OnlyOperator');

    await expect((vault.connect(treasury) as any).claimTicketFor(realPlayer.address, zero))
      .to.emit(vault, 'TicketClaimed').withArgs(realPlayer.address, 1, 1_000_000);
    expect(await buyer.lastRecipient()).to.equal(realPlayer.address);
    expect(await vault.credits(treasury.address)).to.equal(0);
  });
});
