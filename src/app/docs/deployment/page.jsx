import { Code, DocPage, H2, Note, P } from '@/components/docs/DocPage';

const addresses = [
  ['AptCasino', '0xD75b282f87a00856FBF4Aa06bf65833d4AB4b5D7'],
  ['MegapotRewardVault', '0xccec75B83b3Ee3FBAED9a65Da59DBfd585F82943'],
  ['USDC', '0x036CbD53842c5426634e7929541eC2318f3dCF7e'],
  ['Megapot Jackpot', '0x465dA3c859f193A3807386387bEE941B2A4c3279'],
  ['Random Ticket Buyer', '0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746'],
];

export default function DeploymentDocs() {
  return (
    <DocPage eyebrow="Deployment" title="Live on Base Sepolia" lead="The repository, UI and deployed contracts intentionally expose one network: Base Sepolia, chain ID 84532.">
      <H2>Deployed protocol addresses</H2>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/45"><tr><th className="p-4">Contract</th><th className="p-4">Address</th></tr></thead>
          <tbody className="divide-y divide-white/10">{addresses.map(([name, address]) => <tr key={name}><td className="p-4">{name}</td><td className="p-4 font-mono">{address}</td></tr>)}</tbody>
        </table>
      </div>
      <H2>Application variables</H2>
      <P><Code>NEXT_PUBLIC_APTCASINO_ADDRESS</Code> and <Code>NEXT_PUBLIC_MEGAPOT_REWARD_VAULT_ADDRESS</Code> point the UI at these deployments. <Code>NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL</Code> can override the public RPC.</P>
      <H2>Verified funding</H2>
      <P>The casino launched with a 0.02 ETH bankroll. The reward vault launched with 20 Base Sepolia USDC; the successful Megapot smoke-test ticket reduced that balance by the live 0.01 USDC ticket price.</P>
      <Note>Roulette, Wheel, Plinko and Mines were each settled from an Inco covalidator attestation before a real Megapot ticket NFT was claimed.</Note>
    </DocPage>
  );
}
