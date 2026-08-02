import { ethers } from 'hardhat';

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const JACKPOT = '0x465dA3c859f193A3807386387bEE941B2A4c3279';
const RANDOM_BUYER = '0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746';

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('PRIVATE_KEY_BASE_SEPOLIA is required');

  const Vault = await ethers.getContractFactory('MegapotRewardVault');
  const vault = await Vault.deploy(USDC, JACKPOT, RANDOM_BUYER);
  await vault.waitForDeployment();

  const Casino = await ethers.getContractFactory('AptCasino');
  const casino = await Casino.deploy();
  await casino.waitForDeployment();

  await (await vault.setCasino(await casino.getAddress())).wait();
  await (await casino.setRewardVault(await vault.getAddress())).wait();

  const bankroll = ethers.parseEther(process.env.BANKROLL_ETH || '0.02');
  if (bankroll > 0n) await (await casino.depositBankroll({ value: bankroll })).wait();

  const rewardVaultUsdc = ethers.parseUnits(process.env.REWARD_VAULT_USDC || '0', 6);
  if (rewardVaultUsdc > 0n) {
    const usdc = await ethers.getContractAt(
      ['function transfer(address to, uint256 amount) returns (bool)'],
      USDC,
    );
    await (await usdc.transfer(await vault.getAddress(), rewardVaultUsdc)).wait();
  }

  console.log(JSON.stringify({
    chainId: 84532,
    deployer: deployer.address,
    casino: await casino.getAddress(),
    rewardVault: await vault.getAddress(),
    rewardVaultUsdc: ethers.formatUnits(rewardVaultUsdc, 6),
    megapot: { usdc: USDC, jackpot: JACKPOT, randomTicketBuyer: RANDOM_BUYER },
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
