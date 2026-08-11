'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits, parseAbi } from 'viem';
import Link from 'next/link';
import Image from 'next/image';
import { FaTicketAlt, FaPlay, FaShieldAlt, FaGift } from 'react-icons/fa';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import PageShell, { PageCard, SectionHeading } from '@/components/layout/PageShell';
import { MEGAPOT_TESTNET } from '@/lib/baseSepolia';
import { BRAND_LOGOS } from '@/lib/brandLogos';
import { useTreasuryAccount } from '@/lib/treasury/useTreasuryAccount';
import { useMegapotCredits } from '@/lib/inco/useMegapotCredits';

const jackpotAbi = parseAbi(['function ticketPrice() view returns (uint256)']);

const EARN_FROM = [
  { name: 'Roulette', img: '/images/games/roulette.png', link: '/game/roulette' },
  { name: 'Spin Wheel', img: '/images/games/spin_the_wheel.png', link: '/game/wheel' },
  { name: 'Plinko', img: '/images/games/plinko.png', link: '/game/plinko' },
  { name: 'Mines', img: '/images/games/mines.png', link: '/game/mines' },
];

const LOOP_STEPS = [
  {
    icon: FaShieldAlt,
    title: 'Settle an Inco round',
    body: 'The outcome must be attested and paid out on-chain before anything else happens.',
  },
  {
    icon: FaGift,
    title: 'Build credits',
    body: 'Wager volume plus winning rounds increase your progress toward the next ticket.',
  },
  {
    icon: FaTicketAlt,
    title: 'Receive the ticket NFT',
    body: 'The reward vault buys from Megapot with its own USDC and sends the NFT to you.',
  },
];

export default function JackpotPage() {
  const { isConnected } = useAccount();
  const price = useReadContract({ address: MEGAPOT_TESTNET.jackpot, abi: jackpotAbi, functionName: 'ticketPrice' });
  const treasury = useTreasuryAccount();
  const megapot = useMegapotCredits(treasury);
  const [justClaimed, setJustClaimed] = useState(false);
  const progress = Math.min(100, megapot.credits / 10);

  async function handleClaim() {
    setJustClaimed(false);
    const result = await megapot.claim();
    if (result) setJustClaimed(true);
  }

  return (
    <PageShell
      badge="Megapot rewards"
      title="Every round buys a ticket"
      description="Settled Inco rounds earn credits automatically — no separate purchase. 1,000 credits redeem one real Megapot ticket NFT, minted straight to your wallet."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Megapot' }]}
      maxWidth="6xl"
    >
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-3 py-1.5">
          <Image src={BRAND_LOGOS.megapot.src} alt={BRAND_LOGOS.megapot.alt} width={92} height={22} className="h-5 w-auto object-contain" />
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <Image src={BRAND_LOGOS.base.src} alt={BRAND_LOGOS.base.alt} width={18} height={18} className="h-[18px] w-[18px] object-contain" />
          <span className="text-xs font-semibold text-white/70">Base Sepolia</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <Image src={BRAND_LOGOS.inco.src} alt={BRAND_LOGOS.inco.alt} width={18} height={18} className="h-[18px] w-[18px] rounded-sm object-contain" />
          <span className="text-xs font-semibold text-white/70">Inco Lightning</span>
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/game"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              <FaPlay className="text-xs" /> Play games
            </Link>
            <Link
              href="/fairness"
              className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              How it&rsquo;s verified
            </Link>
          </div>

          <section>
            <SectionHeading
              title="Earn credits from"
              subtitle="Every settled confidential round feeds the same Megapot meter."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {EARN_FROM.map((game) => (
                <Link key={game.name} href={game.link} className="group">
                  <div className="p-[1px] rounded-2xl bg-gradient-to-r from-red-magic/50 to-blue-magic/50 transition group-hover:from-red-magic group-hover:to-blue-magic">
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#120010]">
                      <Image
                        src={game.img}
                        alt={game.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-3">
                        <span className="text-sm font-semibold text-white">{game.name}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <PageCard gradient="from-red-magic/50 via-fuchsia-500/30 to-blue-magic/50">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Your ticket meter</p>
            <Image src={BRAND_LOGOS.megapot.src} alt="" width={72} height={18} className="h-4 w-auto rounded-sm bg-white object-contain px-1 py-0.5" />
          </div>
          <p className="mt-4 font-display text-4xl font-bold tabular-nums text-white sm:text-5xl">
            {megapot.credits}
            <span className="ml-2 text-base font-semibold text-white/35 sm:text-lg">/ 1000 credits</span>
          </p>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-magic to-blue-magic transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <span className="block text-[10px] uppercase tracking-wider text-white/40">Ticket price</span>
              <strong className="mt-1 block font-display text-white">
                {price.data != null ? `${formatUnits(price.data, 6)} USDC` : 'Loading…'}
              </strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <span className="block text-[10px] uppercase tracking-wider text-white/40">Referral fee</span>
              <strong className="mt-1 block font-display text-white">None</strong>
            </div>
          </div>

          <div className="mt-6">
            {!isConnected ? (
              <ConnectWalletButton className="w-full justify-center" />
            ) : (
              <button
                type="button"
                disabled={!megapot.vaultConfigured || !megapot.canClaim || megapot.claimPending || megapot.claimReceiptLoading}
                onClick={handleClaim}
                className="w-full rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {megapot.claimPending || megapot.claimReceiptLoading ? 'Minting ticket…' : 'Claim Megapot ticket'}
              </button>
            )}
          </div>
          {(megapot.claimReceiptSuccess || justClaimed) && (
            <p className="mt-3 text-sm text-emerald-300">Ticket minted to your wallet.</p>
          )}
          {megapot.claimError && <p className="mt-3 text-sm text-red-300">{megapot.claimError}</p>}
        </PageCard>
      </div>

      <section className="mt-12">
        <SectionHeading
          title="How Megapot sits in the loop"
          subtitle="Credits are earned from real Inco settlements — not a separate promo page."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {LOOP_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <PageCard key={step.title}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-black text-white/30">0{i + 1}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-magic/25 to-blue-magic/25 ring-1 ring-white/10">
                    <Icon className="text-fuchsia-200" />
                  </span>
                </div>
                <h2 className="mt-5 font-display text-lg font-semibold text-white">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">{step.body}</p>
              </PageCard>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
