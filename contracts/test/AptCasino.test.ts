import { expect } from 'chai';
import { ethers } from 'hardhat';

// Note: anything touching `inco.*` (including the fee check and getFee())
// needs Inco's confidential-compute infra deployed on-chain and reverts on a
// plain local Hardhat network. That full play->reveal->settle flow is covered
// by scripts/smoke-base-sepolia.mjs against the live network, not here. This
// suite only covers wager validation (which runs before any `inco.*` touch)
// and the USDC funding/withdrawal plumbing, which never touches Inco at all.
describe('AptCasino (USDC wager plumbing)', function () {
  async function deploy() {
    const [owner, player] = await ethers.getSigners();
    const Usdc = await ethers.getContractFactory('TestUSDC');
    const usdc = await Usdc.deploy();
    const Casino = await ethers.getContractFactory('AptCasino');
    const casino = await Casino.deploy(await usdc.getAddress());
    return { owner, player, usdc, casino };
  }

  it('rejects a zero per-bet wager or an over-max total wager before touching USDC or Inco', async function () {
    const { casino } = await deploy();
    await expect(casino.playRoulette([{ betType: 0, selection: 5, wager: 0 }])).to.be.revertedWithCustomError(casino, 'InvalidInput');
    const tooBig = (await casino.MAX_WAGER()) + 1n;
    await expect(casino.playRoulette([{ betType: 0, selection: 5, wager: tooBig }])).to.be.revertedWithCustomError(casino, 'InvalidWager');
  });

  it('rejects an empty or oversized roulette bet array', async function () {
    const { casino } = await deploy();
    await expect(casino.playRoulette([])).to.be.revertedWithCustomError(casino, 'InvalidInput');
    const elevenBets = Array.from({ length: 11 }, () => ({ betType: 0, selection: 5, wager: 100_000 }));
    await expect(casino.playRoulette(elevenBets)).to.be.revertedWithCustomError(casino, 'InvalidInput');
  });

  it('accepts USDC bankroll deposits and reports availableBankroll', async function () {
    const { owner, usdc, casino } = await deploy();
    await usdc.mint(owner.address, 5_000_000);
    await usdc.approve(await casino.getAddress(), 5_000_000);
    await expect(casino.depositBankroll(5_000_000)).to.emit(casino, 'BankrollFunded').withArgs(owner.address, 5_000_000);
    expect(await casino.availableBankroll()).to.equal(5_000_000);
  });

  it('lets only the owner withdraw, and only up to availableBankroll', async function () {
    const { owner, player, usdc, casino } = await deploy();
    await usdc.mint(owner.address, 1_000_000);
    await usdc.approve(await casino.getAddress(), 1_000_000);
    await casino.depositBankroll(1_000_000);

    await expect((casino.connect(player) as any).withdraw(1)).to.be.revertedWithCustomError(casino, 'OwnableUnauthorizedAccount');
    await expect(casino.withdraw(1_000_001)).to.be.revertedWithCustomError(casino, 'ExceedsAvailable');
    await expect(casino.withdraw(1_000_000)).to.changeTokenBalances(usdc, [casino, owner], [-1_000_000, 1_000_000]);
  });
});
