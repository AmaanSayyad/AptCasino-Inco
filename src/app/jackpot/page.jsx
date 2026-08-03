'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits, parseAbi } from 'viem';
import Link from 'next/link';
import Image from 'next/image';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import MagicBorder from '@/components/MagicBorder';
import { MEGAPOT_TESTNET } from '@/lib/baseSepolia';
import { useTreasuryAccount } from '@/lib/treasury/useTreasuryAccount';
import { useMegapotCredits } from '@/lib/inco/useMegapotCredits';

const jackpotAbi = parseAbi(['function ticketPrice() view returns (uint256)']);

const EARN_FROM = [
  { name: 'Roulette', img: '/images/games/roulette.png', link: '/game/roulette' },
  { name: 'Spin Wheel', img: '/images/games/spin_the_wheel.png', link: '/game/wheel' },
  { name: 'Plinko', img: '/images/games/plinko.png', link: '/game/plinko' },
  { name: 'Mines', img: '/images/games/mines.png', link: '/game/mines' },
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
    <main className="min-h-screen bg-[#080812] px-5 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <section>
            <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-3 py-1 text-xs font-black uppercase tracking-[.2em] text-fuchsia-200">
              Megapot · Base Sepolia
            </span>
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.05] sm:text-7xl">
              Every round<br />buys a ticket.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
              Settled Inco rounds earn credits automatically — no separate purchase, no referral cut taken by
              AptCasino. 1,000 credits redeem one real Megapot ticket NFT, minted straight to your wallet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/game" className="rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-6 py-3 font-black text-white transition hover:opacity-90">
                Play games
              </Link>
              <Link href="/fairness" className="rounded-xl border border-white/15 px-6 py-3 font-black">
                How it&rsquo;s verified
              </Link>
            </div>

            <div className="mt-12">
              <p className="text-xs font-black uppercase tracking-[.2em] text-white/40">Earn credits from</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {EARN_FROM.map((game) => (
                  <Link key={game.name} href={game.link} className="group">
                    <MagicBorder>
                      <div className="relative aspect-square overflow-hidden rounded-lg">
                        <Image src={game.img} alt={game.name} fill className="object-cover transition-transform duration-300 group-hover:scale-110" />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/85 via-black/10 to-transparent p-2">
                          <span className="text-xs font-bold">{game.name}</span>
                        </div>
                      </div>
                    </MagicBorder>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <aside className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121220]">
            <div className="border-b border-dashed border-white/15 p-7">
              <p className="text-xs font-black uppercase tracking-[.2em] text-white/40">Your ticket meter</p>
              <p className="mt-4 text-5xl font-black">
                {megapot.credits} <span className="text-lg text-white/35">/ 1000 credits</span>
              </p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="p-7">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 p-4">
                  <span className="block text-white/40">Ticket price</span>
                  <strong className="mt-1 block">{price.data != null ? `${formatUnits(price.data, 6)} USDC` : 'Loading…'}</strong>
                </div>
                <div className="rounded-xl bg-white/5 p-4">
                  <span className="block text-white/40">Referral fee</span>
                  <strong className="mt-1 block">None</strong>
                </div>
              </div>
              <div className="mt-6">
                {!isConnected ? <ConnectWalletButton /> : (
                  <button
                    disabled={!megapot.vaultConfigured || !megapot.canClaim || megapot.claimPending || megapot.claimReceiptLoading}
                    onClick={handleClaim}
                    className="w-full rounded-xl bg-fuchsia-500 px-5 py-3 font-black transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {megapot.claimPending || megapot.claimReceiptLoading ? 'Minting ticket…' : 'Claim Megapot ticket'}
                  </button>
                )}
              </div>
              {(megapot.claimReceiptSuccess || justClaimed) && <p className="mt-3 text-sm text-emerald-300">Ticket minted to your wallet.</p>}
              {megapot.claimError && <p className="mt-3 text-sm text-red-300">{megapot.claimError}</p>}
            </div>
          </aside>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ['Settle an Inco round', 'The outcome must be attested and paid out on-chain before anything else happens.'],
            ['Build credits', 'Wager volume plus winning rounds increase your progress toward the next ticket.'],
            ['Receive the ticket NFT', 'The reward vault buys from Megapot with its own USDC and sends the NFT to you.'],
          ].map(([t, d], i) => (
            <div key={t} className="roadmap-glass rounded-2xl p-6">
              <span className="text-sm font-black text-fuchsia-300">0{i + 1}</span>
              <h2 className="mt-3 text-xl font-black">{t}</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
