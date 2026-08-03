import Link from 'next/link';
import RecentProofFeed from '@/components/fairness/RecentProofFeed';

export const metadata = { title: 'Fairness', description: 'How AptCasino verifies Inco game results.' };

const STEPS = [
  { t: 'You place a bet', d: 'Wager locks on Base Sepolia. AptCasino asks Inco Lightning for a sealed random seed — nobody can read it yet, not even the house.' },
  { t: 'Inco attests a reveal', d: 'Covalidators sign off on the seed’s true value. The attestation only matches the exact handle this round created — no substitutions, no do-overs.' },
  { t: 'The contract settles on-chain', d: 'Game rules run against the attested value inside AptCasino.sol. The payout is computed and sent in the same transaction — never decided by your browser.' },
];

export default function FairnessPage() {
  return (
    <main className="min-h-screen bg-[#080812] px-5 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="inline-block rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[.2em] text-emerald-300">
          Verifiable confidentiality
        </p>
        <h1 className="mt-5 font-display text-5xl font-black leading-[1.05] sm:text-7xl">
          The browser never<br />chooses the winner.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
          Every round stores an encrypted Inco seed handle before you know the outcome. Settlement only succeeds
          if the submitted attestation matches that exact handle and Inco&rsquo;s covalidators sign off on it.
        </p>

        <div className="relative mt-14 space-y-6 border-l border-white/10 pl-8 sm:pl-10">
          {STEPS.map((step, i) => (
            <div key={step.t} className="relative">
              <span className="absolute -left-[41px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-red-magic to-blue-magic text-xs font-black sm:-left-[49px]">
                {i + 1}
              </span>
              <div className="roadmap-glass rounded-2xl p-5 sm:p-6">
                <h2 className="font-display text-lg font-bold sm:text-xl">{step.t}</h2>
                <p className="mt-2 text-sm leading-6 text-white/55 sm:text-base">{step.d}</p>
              </div>
            </div>
          ))}
        </div>

        <RecentProofFeed />

        <div className="mt-14 flex flex-wrap items-center gap-4">
          <Link href="/game" className="rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-6 py-3 font-black text-white transition hover:opacity-90">
            Play a confidential round
          </Link>
        </div>
      </div>
    </main>
  );
}
