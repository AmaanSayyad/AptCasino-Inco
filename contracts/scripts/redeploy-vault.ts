import { ethers } from 'hardhat';

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const JACKPOT = '0x465dA3c859f193A3807386387bEE941B2A4c3279';
const RANDOM_BUYER = '0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746';
const APTCASINO = process.env.NEXT_PUBLIC_APTCASINO_ADDRESS as string;
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as string;
const OLD_VAULT = process.env.NEXT_PUBLIC_MEGAPOT_REWARD_VAULT_ADDRESS as string;

async function main() {
  if (!APTCASINO || !TREASURY || !OLD_VAULT) throw new Error('Missing APTCASINO/TREASURY/OLD_VAULT env vars');
  const [deployer] = await ethers.getSigners();

  const usdc = await ethers.getContractAt(
    ['function transfer(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'],
    USDC,
  );

  // Reclaim whatever's left in the old vault before abandoning it.
  const oldVault = await ethers.getContractAt(['function withdrawUsdc(address,uint256) external', 'function owner() view returns (address)'], OLD_VAULT);
  const oldBalance: bigint = await usdc.balanceOf(OLD_VAULT);
  let reclaimHash: string | null = null;
  if (oldBalance > 0n) {
    const tx = await oldVault.withdrawUsdc(deployer.address, oldBalance);
    await tx.wait();
    reclaimHash = tx.hash;
  }

  const Vault = await ethers.getContractFactory('MegapotRewardVault');
  const vault = await Vault.deploy(USDC, JACKPOT, RANDOM_BUYER);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  const setCasinoTx = await vault.setCasino(APTCASINO);
  await setCasinoTx.wait();
  const setOperatorTx = await vault.setOperator(TREASURY);
  await setOperatorTx.wait();

  const casino = await ethers.getContractAt(['function setRewardVault(address) external', 'function owner() view returns (address)'], APTCASINO);
  const setRewardVaultTx = await casino.setRewardVault(vaultAddress);
  await setRewardVaultTx.wait();

  const rewardVaultUsdc = ethers.parseUnits(process.env.REWARD_VAULT_USDC || '5', 6);
  let fundHash: string | null = null;
  if (rewardVaultUsdc > 0n) {
    const tx = await usdc.transfer(vaultAddress, rewardVaultUsdc);
    await tx.wait();
    fundHash = tx.hash;
  }

  console.log(JSON.stringify({
    deployer: deployer.address,
    oldVault: OLD_VAULT,
    oldVaultReclaimedRaw: oldBalance.toString(),
    reclaimHash,
    newVault: vaultAddress,
    setCasinoHash: setCasinoTx.hash,
    setOperatorHash: setOperatorTx.hash,
    setRewardVaultOnCasinoHash: setRewardVaultTx.hash,
    fundedRaw: rewardVaultUsdc.toString(),
    fundHash,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
