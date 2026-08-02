import Link from 'next/link';
import MermaidDiagram from '@/components/docs/MermaidDiagram';
import { DocPage, H2, P, Note } from '@/components/docs/DocPage';

const chart = `flowchart LR
  A[Base wallet] --> B[Lock ETH wager]
  B --> C[Inco sealed seed]
  C --> D[Covalidator attestation]
  D --> E[On-chain settlement]
  E --> F[Megapot credits]
  F --> G[Ticket NFT]`;

export default function DocsHome() { return <DocPage eyebrow="Documentation" title="Confidential games meet the jackpot." lead="AptCasino is a Base Sepolia casino where Inco protects each game outcome until settlement and Megapot turns verified play into jackpot ticket progression."><MermaidDiagram title="The complete player loop" chart={chart} /><Note>Inco Lightning is TEE-backed confidential compute with covalidator attestations. We do not describe it as FHE or as a zero-knowledge proof.</Note><H2>Read by system</H2><div className="grid gap-4 sm:grid-cols-2">{[['Inco Lightning','/docs/inco','Sealed randomness, handle permissions and attested settlement.'],['Megapot rewards','/docs/megapot','Credits, ticket purchase and zero-referral calls.'],['Architecture','/docs/architecture','Contracts, frontend and trust boundaries.'],['Deployment','/docs/deployment','Base Sepolia addresses, configuration and funding.']].map(([title,href,text]) => <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-white/[.03] p-5 hover:bg-white/[.06]"><strong className="text-lg">{title}</strong><P>{text}</P></Link>)}</div><H2>What stays private?</H2><P>The random seed is created as an encrypted Inco handle. A player cannot inspect it while the wager is pending. The public result appears only when the stored handle and covalidator signatures are verified by the game contract.</P></DocPage>; }
