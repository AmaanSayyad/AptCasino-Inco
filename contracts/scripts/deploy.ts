import { ethers } from 'hardhat';

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const JACKPOT = '0x465dA3c859f193A3807386387bEE941B2A4c3279';
const RANDOM_BUYER = '0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('PRIVATE_KEY_BASE_SEPOLIA is required');

  const treasury = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || process.env.TREASURY_ADDRESS || deployer.address) as string;
  const platformReferrer = (process.env.PLATFORM_REFERRER || process.env.NEXT_PUBLIC_PLATFORM_REFERRER || treasury) as string;

  console.log('Deployer', deployer.address);
  console.log('Treasury/operator', treasury);
  console.log('Platform referrer', platformReferrer);

  const Vault = await ethers.getContractFactory('MegapotRewardVault');
  const vault = await Vault.deploy(USDC, JACKPOT, RANDOM_BUYER);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log('Vault', vaultAddress);

  const Casino = await ethers.getContractFactory('AptCasino');
  const casino = await Casino.deploy(USDC);
  await casino.waitForDeployment();
  const casinoAddress = await casino.getAddress();
  console.log('Casino', casinoAddress);

  await (await vault.setCasino(casinoAddress)).wait();
  console.log('setCasino ok');
  await (await vault.setOperator(treasury)).wait();
  console.log('setOperator ok');
  await (await vault.setPlatformReferrer(platformReferrer)).wait();
  console.log('setPlatformReferrer ok');
  await (await casino.setRewardVault(vaultAddress)).wait();
  console.log('setRewardVault ok');

  const usdc = await ethers.getContractAt(
    [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
    ],
    USDC,
  );

  const bankrollUsdc = ethers.parseUnits(process.env.BANKROLL_USDC || '0', 6);
  const bal: bigint = await usdc.balanceOf(deployer.address);
  console.log('Deployer USDC balance', ethers.formatUnits(bal, 6));

  if (bankrollUsdc > 0n) {
    if (bal < bankrollUsdc) {
      console.warn('Skipping bankroll: insufficient USDC');
    } else {
      await (await usdc.approve(casinoAddress, bankrollUsdc)).wait();
      for (let i = 0; i < 8; i++) {
        const allowance: bigint = await usdc.allowance(deployer.address, casinoAddress);
        if (allowance >= bankrollUsdc) break;
        await sleep(1500);
      }
      await (await casino.depositBankroll(bankrollUsdc)).wait();
      console.log('bankroll deposited', ethers.formatUnits(bankrollUsdc, 6));
    }
  }

  const rewardVaultUsdc = ethers.parseUnits(process.env.REWARD_VAULT_USDC || '0', 6);
  if (rewardVaultUsdc > 0n) {
    const bal2: bigint = await usdc.balanceOf(deployer.address);
    if (bal2 < rewardVaultUsdc) {
      console.warn('Skipping vault fund: insufficient USDC');
    } else {
      await (await usdc.transfer(vaultAddress, rewardVaultUsdc)).wait();
      console.log('vault funded', ethers.formatUnits(rewardVaultUsdc, 6));
    }
  }

  console.log(JSON.stringify({
    chainId: 84532,
    deployer: deployer.address,
    treasury,
    platformReferrer,
    casino: casinoAddress,
    rewardVault: vaultAddress,
    bankrollUsdc: ethers.formatUnits(bankrollUsdc, 6),
    rewardVaultUsdc: ethers.formatUnits(rewardVaultUsdc, 6),
    megapot: { usdc: USDC, jackpot: JACKPOT, randomTicketBuyer: RANDOM_BUYER },
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
