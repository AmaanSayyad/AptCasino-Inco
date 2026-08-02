'use client';

import { useMemo, useState } from 'react';
import { useSignMessage } from 'wagmi';
import PageShell from '@/components/layout/PageShell';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { basescanUrl } from '@/lib/baseSepolia';
import {
  FaUser,
  FaCopy,
  FaCheck,
  FaExternalLinkAlt,
  FaClock,
  FaChartLine,
  FaDice,
  FaHistory,
  FaEdit,
} from 'react-icons/fa';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FaChartLine },
  { id: 'games', label: 'Games', icon: FaDice },
  { id: 'activity', label: 'Activity', icon: FaHistory },
];

function fmtNum(n, max = 4) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString(undefined, { maximumFractionDigits: max });
}

function fmtDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function short(addr) {
  if (!addr) return '—';
  const s = String(addr);
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function walletAuthMessage(address, purpose) {
  return `AptCasino ${purpose} for ${address.toLowerCase()}`;
}

export default function ProfileDashboard({
  connected,
  address,
  balanceNative,
  nativeLabel,
  profile,
  games,
  referralStats,
  loading,
  loadingGames,
  onRefresh,
  onRefreshGames,
  onSavedProfile,
}) {
  const [tab, setTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const gameRows = games?.games || [];
  const stats = useMemo(() => {
    const wagered = gameRows.reduce((s, g) => s + Number(g.bet_raw || 0), 0);
    const won = gameRows.reduce((s, g) => s + Number(g.payout_raw || 0), 0);
    const biggestWin = gameRows.reduce((m, g) => Math.max(m, Number(g.payout_raw || 0)), 0);
    return { bets: gameRows.length, wagered, won, netPnl: won - wagered, biggestWin };
  }, [gameRows]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  if (!connected) {
    return (
      <PageShell
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Profile' }]}
        badge="Account"
        title="Your profile"
        description="Connect a wallet to view balances, game stats, and referral activity."
        maxWidth="4xl"
      >
        <div className="rounded-2xl border border-white/10 bg-[#1A0015]/80 p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-magic/30 to-blue-magic/30 border border-white/10">
            <FaUser className="text-3xl text-white/40" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">Wallet not connected</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
            Connect on Base Sepolia to unlock your player dashboard — balance, P&amp;L, game history, and referral stats.
          </p>
          <div className="mt-8 flex justify-center"><ConnectWalletButton /></div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Profile' }]}
      badge="Base Sepolia"
      title={profile?.handle || short(address)}
      description="On-chain balance, game stats, and account activity for your connected wallet."
      maxWidth="6xl"
    >
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1A0015]/90 p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-red-magic/40 to-blue-magic/40 border border-white/10 flex items-center justify-center">
                <FaUser className="text-3xl text-white/50" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{profile?.handle || 'Anonymous player'}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="hidden font-mono text-xs text-white/60 sm:inline">{address}</code>
                <code className="font-mono text-xs text-white/60 sm:hidden">{short(address)}</code>
                <button type="button" onClick={copyAddress} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white" title="Copy address">
                  {copied ? <FaCheck className="text-emerald-400" /> : <FaCopy className="text-xs" />}
                </button>
                <a href={basescanUrl('address', address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/55 hover:bg-white/10">
                  Explorer <FaExternalLinkAlt className="text-[8px]" />
                </a>
              </div>
              {profile?.bio ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{profile.bio}</p> : null}
              {profile?.memberSince ? (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/45"><FaClock /> Since {new Date(profile.memberSince).toLocaleDateString()}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-64 shrink-0">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Wallet balance</p>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums">{balanceNative != null ? fmtNum(balanceNative) : '…'} <span className="text-sm text-white/45">{nativeLabel}</span></p>
            </div>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:bg-white/10">
              <FaEdit /> Edit profile
            </button>
          </div>
        </div>
      </section>

      <nav className="mt-6 flex gap-2 border-b border-white/10 pb-px">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${tab === id ? 'border-b-2 border-fuchsia-400 text-white' : 'text-white/50 hover:text-white'}`}>
            <Icon className="text-xs" /> {label}
          </button>
        ))}
      </nav>

      <div className="py-6">
        {tab === 'overview' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total bets" value={loadingGames ? '…' : stats.bets.toLocaleString()} />
            <StatTile label="Wagered" value={loadingGames ? '…' : `${fmtNum(stats.wagered, 2)} USDC`} />
            <StatTile label="Net P&L" value={loadingGames ? '…' : `${stats.netPnl >= 0 ? '+' : ''}${fmtNum(stats.netPnl, 2)} USDC`} tone={stats.netPnl >= 0 ? 'emerald' : 'default'} />
            <StatTile label="Biggest win" value={loadingGames ? '…' : `${fmtNum(stats.biggestWin, 2)} USDC`} />
          </div>
        )}

        {tab === 'games' && (
          <div className="space-y-2">
            {loadingGames ? (
              <p className="text-white/55">Loading…</p>
            ) : gameRows.length === 0 ? (
              <p className="text-white/55">No games played yet.</p>
            ) : gameRows.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold capitalize text-white">{g.game}</p>
                  <p className="text-xs text-white/45">{fmtDate(g.created_at)}</p>
                </div>
                <p className="text-sm font-bold text-white">{fmtNum(g.bet_raw, 2)} → {fmtNum(g.payout_raw, 2)} USDC</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'activity' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Referral code" value={referralStats?.code || '—'} />
            <StatTile label="Valid referrals" value={referralStats?.validReferrals ?? 0} />
            <StatTile label="Rewards tracked" value={fmtNum(referralStats?.earnedRaw ?? 0, 0)} />
          </div>
        )}
      </div>

      {editing && (
        <EditProfileModal
          address={address}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onSavedProfile?.(); }}
        />
      )}
    </PageShell>
  );
}

function StatTile({ label, value, tone = 'default' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-[#1A0015]/80 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function EditProfileModal({ address, profile, onClose, onSaved }) {
  const { signMessageAsync } = useSignMessage();
  const [handle, setHandle] = useState(profile?.handle || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const message = walletAuthMessage(address, 'update profile');
      const signature = await signMessageAsync({ message });
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, handle, bio, signature }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not save profile');
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0011] p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">Edit profile</h3>
        <label className="mt-4 block text-sm">
          <span className="text-white/60">Display name</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={32} className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white" />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-white/60">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white" />
        </label>
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-gradient-to-r from-red-magic to-blue-magic px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Signing & saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
