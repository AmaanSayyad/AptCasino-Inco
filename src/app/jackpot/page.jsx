'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits, parseAbi } from 'viem';
import Link from 'next/link';
import Image from 'next/image';
import { FaTicketAlt, FaPlay, FaShieldAlt, FaGift, FaUsers, FaTrophy, FaBolt } from 'react-icons/fa';
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

function shortWallet(w) {
  if (!w) return '—';
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function Countdown({ endedAt }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    if (!endedAt) return undefined;
    const tick = () => {
      const ms = new Date(endedAt).getTime() - Date.now();
      if (ms <= 0) {
        setLeft('Drawing soon');
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endedAt]);
  return <span className="tabular-nums">{left || '—'}</span>;
}

export default function JackpotPage() {
  const { address, isConnected } = useAccount();
  const price = useReadContract({ address: MEGAPOT_TESTNET.jackpot, abi: jackpotAbi, functionName: 'ticketPrice' });

  const treasury = useTreasuryAccount();
  const megapot = useMegapotCredits(treasury);
  const [justClaimed, setJustClaimed] = useState(false);
  const [round, setRound] = useState(null);
  const [race, setRace] = useState(null);
  const [pools, setPools] = useState([]);
  const [walletMp, setWalletMp] = useState(null);
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolMsg, setPoolMsg] = useState('');
  const progress = Math.min(100, megapot.credits / 10);

  const refreshSocial = useCallback(() => {
    fetch('/api/megapot/round').then((r) => r.json()).then(setRound).catch(() => {});
    fetch('/api/megapot/race?hours=24').then((r) => r.json()).then(setRace).catch(() => {});
    fetch('/api/megapot/pools').then((r) => r.json()).then((j) => setPools(j.pools || [])).catch(() => {});
    if (address) {
      fetch(`/api/megapot/wallet?wallet=${address}`).then((r) => r.json()).then(setWalletMp).catch(() => {});
    }
  }, [address]);

  useEffect(() => {
    refreshSocial();
    const id = setInterval(refreshSocial, 30_000);
    return () => clearInterval(id);
  }, [refreshSocial]);

  async function handleClaim() {
    setJustClaimed(false);
    const result = await megapot.claim();
    if (result) {
      setJustClaimed(true);
      setTimeout(refreshSocial, 2000);
    }
  }

  async function contributeToPool(poolId, credits = 100) {
    setPoolMsg('');
    setPoolBusy(true);
    try {
      const active = await treasury.ensureSession();
      const res = await fetch('/api/megapot/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.token}` },
        body: JSON.stringify({ poolId, credits }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || 'Contribute failed');
      setPoolMsg(`Contributed ${credits} credits. Pool tickets: ${res.ticketsBought}`);
      refreshSocial();
      megapot; // credits refresh via interval
    } catch (e) {
      setPoolMsg(e instanceof Error ? e.message : 'Contribute failed');
    } finally {
      setPoolBusy(false);
    }
  }

  return (
    <PageShell
      badge="Megapot social rewards"
      title="Play into the jackpot together"
      description="Every settled Inco round earns credits toward real Megapot ticket NFTs — with live prize pools, community ticket pools, referral splits, and a 24h ticket race."
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

      {/* Live round strip */}
      <PageCard gradient="from-amber-500/40 via-fuchsia-500/25 to-blue-magic/40" className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Live Megapot drawing</p>
            <p className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
              {round?.active?.prizePoolUsdc != null
                ? `$${round.active.prizePoolUsdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : '…'}
            </p>
            <p className="mt-1 text-sm text-white/50">
              Round #{round?.active?.id || '—'}
              {round?.active?.ticketCount != null && ` · ${round.active.ticketCount} tickets · ${round.active.uniqueParticipants ?? '—'} players`}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Time to draw</p>
            <p className="mt-1 font-display text-lg text-amber-200">
              <Countdown endedAt={round?.active?.endedAt} />
            </p>
          </div>
        </div>
        {round?.active?.prizeTiers?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {round.active.prizeTiers.slice(0, 6).map((t) => (
              <span key={t.tierId} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                {t.normals}N{t.bonus ? '+B' : ''}: ${t.payoutUsdc.toFixed(0)}
              </span>
            ))}
          </div>
        )}
      </PageCard>

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
              href="/referral"
              className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Invite &amp; earn referrer cut
            </Link>
          </div>

          <section>
            <SectionHeading
              title="Earn credits from"
              subtitle="Every settled confidential round feeds the same Megapot meter — claims now include platform + inviter referrers on-chain."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {EARN_FROM.map((game) => (
                <Link key={game.name} href={game.link} className="group">
                  <div className="p-[1px] rounded-2xl bg-gradient-to-r from-red-magic/50 to-blue-magic/50 transition group-hover:from-red-magic group-hover:to-blue-magic">
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#120010]">
                      <Image src={game.img} alt={game.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-3">
                        <span className="text-sm font-semibold text-white">{game.name}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Community pools */}
          <section>
            <SectionHeading
              icon={<FaUsers className="text-fuchsia-300" />}
              title="Community ticket pools"
              subtitle="Pool credits with other players. Every 1000 credits fills a shared ticket slot for this drawing."
            />
            <div className="space-y-3">
              {(pools.length ? pools : [{ id: 'placeholder', name: 'Community Megapot Pool', description: '', contributed_credits: 0, target_credits: 1000, tickets_bought: 0, progress: 0, members: [] }]).map((pool) => (
                <PageCard key={pool.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-white">{pool.name}</h3>
                      {pool.description ? <p className="mt-1 text-sm text-white/50">{pool.description}</p> : null}
                    </div>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      {pool.tickets_bought || 0} tickets
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-magic" style={{ width: `${pool.progress || 0}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-white/45">
                    {pool.contributed_credits || 0} / {pool.target_credits || 1000} credits toward next ticket
                  </p>
                  {pool.members?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {pool.members.slice(0, 5).map((m) => (
                        <li key={m.wallet} className="flex justify-between text-xs text-white/60">
                          <span className="font-mono">{shortWallet(m.wallet)}</span>
                          <span>{m.credits} cr</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    disabled={!isConnected || poolBusy || pool.id === 'placeholder'}
                    onClick={() => contributeToPool(pool.id, 100)}
                    className="mt-4 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    {poolBusy ? 'Contributing…' : 'Contribute 100 credits'}
                  </button>
                </PageCard>
              ))}
              {poolMsg && <p className="text-sm text-white/70">{poolMsg}</p>}
            </div>
          </section>
        </div>

        <div className="space-y-6">
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
              <div className="h-full rounded-full bg-gradient-to-r from-red-magic to-blue-magic transition-all" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <span className="block text-[10px] uppercase tracking-wider text-white/40">Ticket price</span>
                <strong className="mt-1 block font-display text-white">
                  {price.data != null ? `${formatUnits(price.data, 6)} USDC` : 'Loading…'}
                </strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <span className="block text-[10px] uppercase tracking-wider text-white/40">Referral on buy</span>
                <strong className="mt-1 block font-display text-white">Platform + inviter</strong>
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
              <p className="mt-3 text-sm text-emerald-300">Ticket minted — platform + inviter referrers attached on-chain.</p>
            )}
            {megapot.claimError && <p className="mt-3 text-sm text-red-300">{megapot.claimError}</p>}

            {walletMp?.stats && (
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-black/20 p-2">
                  <span className="text-white/40">Your tickets</span>
                  <p className="font-semibold text-white">{walletMp.stats.totalTickets}</p>
                </div>
                <div className="rounded-lg bg-black/20 p-2">
                  <span className="text-white/40">Referral earn</span>
                  <p className="font-semibold text-white">${walletMp.stats.referralEarningsUsdc?.toFixed?.(2) ?? '0'}</p>
                </div>
              </div>
            )}
          </PageCard>

          {/* Ticket race */}
          <PageCard>
            <SectionHeading
              icon={<FaTrophy className="text-amber-300" />}
              title="24h ticket race"
              subtitle="Most Megapot tickets claimed via AptCasino this day."
            />
            <p className="mb-3 text-xs text-white/40">
              {race?.totalTickets != null ? `${race.totalTickets} tickets in window` : 'Loading…'}
            </p>
            <ul className="space-y-2">
              {(race?.leaderboard || []).slice(0, 10).map((row, i) => (
                <li key={row.wallet} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-white/35">#{i + 1}</span>
                    <span className="font-mono text-white/80">{shortWallet(row.wallet)}</span>
                  </span>
                  <span className="font-bold text-amber-200">{row.tickets}</span>
                </li>
              ))}
              {(!race?.leaderboard || race.leaderboard.length === 0) && (
                <li className="text-sm text-white/45">No claims yet this window — be first.</li>
              )}
            </ul>
          </PageCard>

          {/* Global players */}
          <PageCard>
            <SectionHeading
              icon={<FaBolt className="text-blue-300" />}
              title="Drawing players"
              subtitle="Top wallets in the active Megapot round (protocol Data API)."
            />
            <ul className="space-y-2">
              {(round?.players || []).slice(0, 8).map((p, i) => (
                <li key={p.wallet} className="flex justify-between text-sm text-white/70">
                  <span className="font-mono">#{i + 1} {shortWallet(p.wallet)}</span>
                  <span>{p.tickets} tix</span>
                </li>
              ))}
              {(!round?.players || round.players.length === 0) && (
                <li className="text-sm text-white/45">Waiting for round data…</li>
              )}
            </ul>
          </PageCard>
        </div>
      </div>

      <section className="mt-12">
        <SectionHeading
          title="How deep Megapot works here"
          subtitle="More than earn→claim: live pool, community slots, referrers on every buy, multiplayer race."
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: FaShieldAlt, title: 'Settle Inco', body: 'Attested outcomes on Base Sepolia fund credits.' },
            { icon: FaGift, title: 'Credits + pools', body: 'Solo claim or contribute to a community ticket pool.' },
            { icon: FaTicketAlt, title: 'Buy with referrers', body: 'Platform 70% + inviter 30% on Megapot fee/win-share.' },
            { icon: FaTrophy, title: 'Race & drawing', body: '24h ticket race + live prize pool competition.' },
          ].map((step, i) => {
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
