'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { FaTrophy, FaSync, FaClock, FaUsers, FaCoins, FaGamepad, FaCheckCircle } from 'react-icons/fa';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TOURNAMENT_TREASURY_ADDRESS || '';

function fmtVol(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function useCountdown(endsAt) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!endsAt) { setLeft(null); return; }
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) { setLeft({ over: true, d: 0, h: 0, m: 0 }); return; }
      const s = Math.floor(ms / 1000);
      setLeft({ over: false, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}

export default function CompetitionLeaderboardPanel() {
  const { address, isConnected } = useAccount();
  const [competitions, setCompetitions] = useState([]);
  const [registering, setRegistering] = useState(null);
  const [loading, setLoading] = useState(true);
  const { writeContractAsync } = useWriteContract();
  const [pendingHash, setPendingHash] = useState(null);
  const receipt = useWaitForTransactionReceipt({ hash: pendingHash || undefined });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/competitions/active');
      const j = await r.json();
      setCompetitions(j.competitions || []);
    } catch {
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const active = competitions[0];
  const countdown = useCountdown(active?.ends_at);

  const register = async (tournament) => {
    if (!address) return;
    setRegistering(tournament.id);
    try {
      let entryFeeTxHash = null;
      const fee = Number(tournament.entry_fee) || 0;
      if (fee > 0) {
        if (!TREASURY_ADDRESS) {
          toast.error('Entry fee collection is not configured yet — ask an admin to set NEXT_PUBLIC_TOURNAMENT_TREASURY_ADDRESS.');
          return;
        }
        toast.info(`Confirm ${fmtVol(fee)} USDC entry fee in your wallet…`);
        const hash = await writeContractAsync({
          address: usdcAddress, abi: usdcAbi, functionName: 'transfer',
          args: [TREASURY_ADDRESS, parseUnits(String(fee), USDC_DECIMALS)],
        });
        setPendingHash(hash);
        entryFeeTxHash = hash;
      }

      const r = await fetch('/api/tournaments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, tournamentId: tournament.id, entryFeeTxHash, entryFeeAmount: fee || null }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409) { toast.info('Already registered.'); await load(); return; }
        throw new Error(d.error || 'Registration failed');
      }
      toast.success(fee > 0 ? `Paid ${fmtVol(fee)} USDC — you're in!` : "You're in — start playing to climb the board.");
      await load();
    } catch (e) {
      toast.error(e.message || 'Registration failed');
    } finally {
      setRegistering(null);
    }
  };

  if (!loading && competitions.length === 0) {
    return (
      <EmptyCup
        title="No active Volume Cup"
        description="Check back soon — the next seasonal volume competition will appear here when it goes live."
        action={{ href: '/game', label: 'Play games' }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-[#1a0a12] to-[#120010] p-5 md:p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {loading ? (
              <div className="h-7 w-48 animate-pulse rounded bg-white/10" />
            ) : (
              <h3 className="font-display text-xl font-bold text-white md:text-2xl">{active?.name}</h3>
            )}
            <p className="mt-1 text-sm text-white/50">Wager volume on qualifying games · Base Sepolia registration · USDC prizes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50">
              <FaSync className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {!isConnected ? (
              <ConnectWalletButton className="!px-5 !py-2 !text-xs !font-bold !uppercase !tracking-wider" label="Connect to join" />
            ) : active ? (
              <button
                type="button"
                onClick={() => register(active)}
                disabled={registering === active.id || (active.max_participants && active.participantCount >= active.max_participants)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-lg disabled:opacity-50"
              >
                {registering === active.id ? 'Joining…' : (active.max_participants && active.participantCount >= active.max_participants) ? 'Cup full' : !active.entry_fee ? 'Join cup' : `Join · ${fmtVol(active.entry_fee)} USDC`}
              </button>
            ) : null}
          </div>
        </div>

        {active && (
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatPill icon={<FaCoins className="text-amber-300" />} label="Prize pool" value={loading ? '…' : `${fmtVol(active.prize_pool)} USDC`} />
            <StatPill icon={<FaCoins className="text-emerald-300" />} label="Entry fee" value={loading ? '…' : (active.entry_fee ? `${fmtVol(active.entry_fee)} USDC` : 'Free')} />
            <StatPill icon={<FaUsers className="text-purple-300" />} label="Registered" value={loading ? '…' : `${active.participantCount ?? 0}${active.max_participants ? ` / ${active.max_participants}` : ''}`} />
            <StatPill icon={<FaClock className="text-cyan-300" />} label="Time left" value={loading ? '…' : countdown?.over ? 'Ended' : countdown ? `${countdown.d}d ${countdown.h}h ${countdown.m}m` : '—'} />
          </div>
        )}
      </motion.div>

      {receipt.isSuccess && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2">
            <FaCheckCircle /> Entry fee confirmed on-chain.
          </motion.div>
        </AnimatePresence>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-white/60 flex items-center gap-3">
        <FaGamepad className="text-purple-300 shrink-0" />
        Live wager-volume standings for this cup aren&apos;t wired up yet — check the{' '}
        <Link href="/leaderboard" className="text-purple-300 hover:text-white underline underline-offset-2">all-time leaderboard</Link> in the meantime.
      </div>

      {competitions.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">Other upcoming cups</p>
          <div className="space-y-2">
            {competitions.slice(1).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                <span className="text-white/80">{t.name}</span>
                <span className="text-xs text-white/45">{new Date(t.starts_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">{icon} {label}</div>
      <p className="mt-1 text-lg font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function EmptyCup({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
      <FaTrophy className="mx-auto mb-4 text-4xl text-white/20" />
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/50">{description}</p>
      {action && (
        <Link href={action.href} className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white">
          {action.label}
        </Link>
      )}
    </div>
  );
}
