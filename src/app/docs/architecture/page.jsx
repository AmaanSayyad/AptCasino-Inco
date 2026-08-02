import Image from 'next/image';
import MermaidDiagram from '@/components/docs/MermaidDiagram';
import { DocPage, H2, P } from '@/components/docs/DocPage';

const graph = `flowchart TB
  subgraph Browser
    UI[Next.js game UI]
    SDK[Inco Lightning JS]
    Wallet[RainbowKit / wagmi]
  end
  subgraph BaseSepolia[Base Sepolia]
    Casino[AptCasino.sol]
    Vault[MegapotRewardVault.sol]
    Verifier[Inco verifier]
    Jackpot[Megapot Jackpot]
    Ticket[Ticket NFT]
  end
  UI --> Wallet
  UI --> SDK
  Wallet --> Casino
  SDK --> Verifier
  Casino --> Verifier
  Casino -. award .-> Vault
  Vault --> Jackpot
  Jackpot --> Ticket`;

export default function ArchitectureDocs() { return <DocPage eyebrow="Architecture" title="One chain, two protocol roles" lead="Inco owns confidential outcome integrity. Megapot owns the jackpot ticket and drawing lifecycle. AptCasino connects them through verified reward progression."><MermaidDiagram title="Component graph" chart={graph} /><H2>Trust boundaries</H2><P>The frontend is an orchestrator and renderer; it does not decide outcomes. The casino contract verifies Inco attestations and enforces bankroll exposure. The reward vault is an independently funded USDC treasury. Megapot contracts mint and settle ticket NFTs.</P><Image src="/docs/aptcasino-architecture.svg" width={1200} height={640} alt="AptCasino Inco and Megapot architecture diagram" className="my-7 h-auto w-full rounded-2xl border border-white/10 bg-[#0b0b15]" /><H2>Removed systems</H2><P>There is no Aptos adapter, Solana adapter, multichain switcher, server-ledger deposit system, referral attribution, OTC lottery, staking or litepaper in the target architecture. AptCasino is a brand name; it does not mean Aptos.</P></DocPage>; }
