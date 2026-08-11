'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaLock, FaShieldAlt, FaCheckCircle } from 'react-icons/fa';
import PageShell, { PageCard, SectionHeading } from '@/components/layout/PageShell';
import RecentProofFeed from '@/components/fairness/RecentProofFeed';
import { BRAND_LOGOS } from '@/lib/brandLogos';

const STEPS = [
  {
    t: 'You place a bet',
    d: 'Wager locks on Base Sepolia. AptCasino asks Inco Lightning for a sealed random seed — nobody can read it yet, not even the house.',
    icon: FaLock,
  },
  {
    t: 'Inco attests a reveal',
    d: 'Covalidators sign off on the seed’s true value. The attestation only matches the exact handle this round created — no substitutions, no do-overs.',
    icon: FaShieldAlt,
  },
  {
    t: 'The contract settles on-chain',
    d: 'Game rules run against the attested value inside AptCasino.sol. The payout is computed and sent in the same transaction — never decided by your browser.',
    icon: FaCheckCircle,
  },
];

export default function FairnessPage() {
  return (
    <PageShell
      badge="Verifiable confidentiality"
      title="The browser never chooses the winner"
      description="Every round stores an encrypted Inco seed handle before you know the outcome. Settlement only succeeds if the submitted attestation matches that exact handle and Inco’s covalidators sign off on it."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Fairness' }]}
      maxWidth="5xl"
    >
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {[
          { ...BRAND_LOGOS.inco, label: 'Inco Lightning' },
          { ...BRAND_LOGOS.base, label: 'Base Sepolia' },
          { ...BRAND_LOGOS.megapot, label: 'Megapot rewards', lightPad: true },
        ].map((brand) => (
          <span
            key={brand.label}
            className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 ${brand.lightPad ? 'bg-white' : 'bg-white/[0.04]'}`}
          >
            <Image
              src={brand.src}
              alt={brand.alt}
              width={18}
              height={18}
              className={`h-[18px] w-[18px] object-contain ${brand.lightPad ? '' : 'rounded-sm'}`}
            />
            <span className={brand.lightPad ? 'text-[#111]' : ''}>{brand.label}</span>
          </span>
        ))}
      </div>

      <SectionHeading
        icon={<FaLock className="text-fuchsia-300" />}
        title="How a confidential round settles"
        subtitle="Same play → reveal → settle loop across roulette, wheel, plinko, and mines."
      />

      <div className="relative space-y-4 border-l border-white/10 pl-8 sm:pl-10 mb-12">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.t} className="relative">
              <span className="absolute -left-[41px] top-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-red-magic to-blue-magic text-xs font-black sm:-left-[49px]">
                {i + 1}
              </span>
              <PageCard>
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
                    <Icon className="text-fuchsia-300" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white sm:text-xl">{step.t}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/55 sm:text-base">{step.d}</p>
                  </div>
                </div>
              </PageCard>
            </div>
          );
        })}
      </div>

      <RecentProofFeed />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href="/game"
          className="rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          Play a confidential round
        </Link>
        <Link
          href="/jackpot"
          className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Megapot rewards
        </Link>
      </div>
    </PageShell>
  );
}
