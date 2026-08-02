'use client';

import Link from 'next/link';
import Image from 'next/image';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { stageCopy, stageProgress } from '@/lib/inco/useConfidentialGame';

export const GAME_COPY = {
  roulette: { title: 'Confidential Roulette', intro: 'Pick a bet. Inco seals the winning number until your wager is locked.', accent: 'from-red-500 to-rose-700', image: '/images/games/roulette.png' },
  wheel: { title: 'Confidential Wheel', intro: 'The landing segment is encrypted before the wheel starts moving.', accent: 'from-violet-500 to-fuchsia-700', image: '/images/games/spin_the_wheel.png' },
  plinko: { title: 'Confidential Plinko', intro: 'Inco chooses the hidden path; the board replays the verified bucket.', accent: 'from-cyan-500 to-blue-700', image: '/images/games/plinko.png' },
  mines: { title: 'Confidential Mines', intro: 'Select tiles before the encrypted board is revealed. No browser-generated bombs.', accent: 'from-amber-400 to-orange-700', image: '/images/games/mines.png' },
};

export default function GameShell({ game, children, aside }) {
  const copy = GAME_COPY[game];
  return (
    <main className="site-game-page min-h-screen bg-gradient-to-b from-sharp-black to-[#150012] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/game" className="text-sm font-semibold text-white/55 hover:text-white">← All games</Link>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">Inco Lightning · Base Sepolia</span>
        </div>
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-red-magic to-blue-magic p-[1px] shadow-2xl shadow-fuchsia-950/30">
          <div className="rounded-3xl bg-[#10000d]">
            <div className={`relative overflow-hidden bg-gradient-to-r ${copy.accent} px-6 py-10 sm:px-10`}>
              <div className="relative z-10 max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">AptCasino · Inco Lightning</p>
                <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">{copy.title}</h1>
                <p className="mt-3 max-w-xl text-white/80">{copy.intro}</p>
              </div>
              <Image src={copy.image} alt="" fill className="object-cover opacity-20 mix-blend-screen" priority />
            </div>
            <div className="grid gap-8 p-6 lg:grid-cols-[1fr_340px] lg:p-10">
              <div>{children}</div>
              <aside className="space-y-4">{aside}</aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/45">{label}</span>{children}</label>;
}

export function WagerAndPlay({ hook, onPlay, disabled }) {
  return (
    <>
      <div className="mt-6"><Field label="Wager (USDC)"><input className="game-input" type="number" min="0.1" max="10" step="0.1" value={hook.wager} onChange={(e) => hook.setWager(e.target.value)} /></Field></div>
      <div className="mt-6">
        {!hook.isConnected ? (
          <ConnectWalletButton />
        ) : (
          <button onClick={onPlay} disabled={hook.busy || disabled} className="rounded-xl bg-white px-7 py-3 font-black text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-50">
            {hook.stage === 'idle' || hook.stage === 'done' || hook.stage === 'error' ? 'Play confidential round' : stageCopy[hook.stage]}
          </button>
        )}
      </div>
      {hook.error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{hook.error}</p>}
    </>
  );
}

export function ResultPanel({ game, hook }) {
  if (!hook.outcome) return null;
  return (
    <div className="mt-7 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Verified result</p>
      <p className="mt-2 text-2xl font-black">{resultLabel(game, hook.outcome)}</p>
      <p className="mt-1 text-white/65">Payout: {hook.payout} USDC</p>
      <a className="mt-3 inline-block text-xs text-emerald-300 hover:underline" href={`https://sepolia.basescan.org/tx/${hook.settleHash}`} target="_blank" rel="noreferrer">View settlement on BaseScan ↗</a>
    </div>
  );
}

function resultLabel(game, outcome) {
  if (game === 'roulette') return `Winning number: ${outcome.winningNumber}`;
  if (game === 'wheel') return `Segment ${Number(outcome.segment) + 1} · ${(Number(outcome.multiplierBps) / 10000).toFixed(2)}×`;
  if (game === 'plinko') return `Bucket ${outcome.bucket} · ${(Number(outcome.multiplierBps) / 10000).toFixed(2)}×`;
  return outcome.hitMine ? 'Mine hit' : `Safe · mines at ${outcome.minePositions.map((n) => Number(n) + 1).join(', ')}`;
}

export function GameAside({ game, hook }) {
  const copy = GAME_COPY[game];
  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-white/45">Round status</p>
        <p className="mt-2 font-black">{stageCopy[hook.stage]}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full bg-gradient-to-r ${copy.accent} transition-all`} style={{ width: `${stageProgress[hook.stage]}%` }} />
        </div>
      </div>
      <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200">Megapot progress</p>
        <p className="mt-2 text-3xl font-black">{hook.credits} <span className="text-base text-white/50">/ 1000</span></p>
        <p className="mt-2 text-sm leading-6 text-white/60">Every settled round earns credits. Winning rounds earn a bonus. 1,000 credits redeem one real Megapot testnet ticket NFT.</p>
        <button
          disabled={!hook.vaultConfigured || hook.credits < 1000 || hook.claimPending || hook.claimReceiptLoading}
          onClick={() => hook.claim({ address: hook.rewardVaultAddress, abi: hook.rewardVaultAbi, functionName: 'claimTicket' })}
          className="mt-4 w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-black disabled:opacity-40"
        >
          {hook.claimPending || hook.claimReceiptLoading ? 'Claiming…' : 'Claim Megapot ticket'}
        </button>
      </div>
      <Link href="/fairness" className="block rounded-2xl border border-white/10 p-5 text-sm text-white/65 transition hover:bg-white/5 hover:text-white">
        <strong className="block text-white">How privacy works</strong>
        <span className="mt-1 block">Read how Inco + Megapot keep rounds provably fair →</span>
      </Link>
    </>
  );
}
