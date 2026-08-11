import { ethers } from 'hardhat';

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const casinoAddress = process.env.CASINO as string;
  const vaultAddress = process.env.VAULT as string;
  const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as string;
  const platformReferrer = (process.env.PLATFORM_REFERRER || treasury) as string;
  if (!casinoAddress || !vaultAddress || !treasury) throw new Error('CASINO, VAULT, NEXT_PUBLIC_TREASURY_ADDRESS required');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer', deployer.address);

  const vault = await ethers.getContractAt(
    [
      'function setOperator(address) external',
      'function setPlatformReferrer(address) external',
      'function setCasino(address) external',
      'function operator() view returns (address)',
      'function platformReferrer() view returns (address)',
      'function casino() view returns (address)',
    ],
    vaultAddress,
  );
  const casino = await ethers.getContractAt(
    [
      'function setRewardVault(address) external',
      'function rewardVault() view returns (address)',
      'function depositBankroll(uint256) external',
    ],
    casinoAddress,
  );

  await sleep(3000);

  const currentCasino = await vault.casino().catch(() => ethers.ZeroAddress);
  if (currentCasino.toLowerCase() !== casinoAddress.toLowerCase()) {
    await (await vault.setCasino(casinoAddress)).wait();
    console.log('setCasino');
  }

  await (await vault.setOperator(treasury)).wait();
  console.log('setOperator', treasury);
  await sleep(2000);
  await (await vault.setPlatformReferrer(platformReferrer)).wait();
  console.log('setPlatformReferrer', platformReferrer);
  await sleep(2000);
  await (await casino.setRewardVault(vaultAddress)).wait();
  console.log('setRewardVault', vaultAddress);

  const usdc = await ethers.getContractAt(
    [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
    ],
    USDC,
  );

  const bankrollUsdc = ethers.parseUnits(process.env.BANKROLL_USDC || '5', 6);
  const rewardVaultUsdc = ethers.parseUnits(process.env.REWARD_VAULT_USDC || '2', 6);
  const bal: bigint = await usdc.balanceOf(deployer.address);
  console.log('USDC balance', ethers.formatUnits(bal, 6));

  if (bankrollUsdc > 0n && bal >= bankrollUsdc) {
    await (await usdc.approve(casinoAddress, bankrollUsdc)).wait();
    await sleep(2000);
    await (await casino.depositBankroll(bankrollUsdc)).wait();
    console.log('bankroll', ethers.formatUnits(bankrollUsdc, 6));
  }

  const bal2: bigint = await usdc.balanceOf(deployer.address);
  if (rewardVaultUsdc > 0n && bal2 >= rewardVaultUsdc) {
    await (await usdc.transfer(vaultAddress, rewardVaultUsdc)).wait();
    console.log('vault funded', ethers.formatUnits(rewardVaultUsdc, 6));
  }

  console.log(JSON.stringify({
    casino: casinoAddress,
    rewardVault: vaultAddress,
    operator: await vault.operator(),
    platformReferrer: await vault.platformReferrer(),
    linkedVault: await casino.rewardVault(),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
