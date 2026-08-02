'use client';

import { useCallback, useEffect, useState } from 'react';
import { basescanUrl } from '@/lib/baseSepolia';

const TOKEN_KEY = 'aptcasino_admin_token';
const TABS = ['Overview', 'Users', 'Banned wallets', 'Game history', 'Tournaments', 'KOL allocations'];

function fmt(n, max = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString(undefined, { maximumFractionDigits: max });
}

function short(addr) {
  if (!addr) return '—';
  const s = String(addr);
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function useAdminApi(token) {
  return useCallback(
    async (path, options = {}) => {
      const r = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token, ...(options.headers || {}) },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
      return j;
    },
    [token],
  );
}

export default function AdminDashboard() {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (stored) setToken(stored);
  }, []);

  const signIn = (e) => {
    e.preventDefault();
    window.localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sharp-black to-[#150012] flex items-center justify-center px-4">
        <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A0015]/90 p-8">
          <h1 className="text-xl font-display font-bold text-white mb-1">Admin dashboard</h1>
          <p className="text-sm text-white/50 mb-6">Enter the DASHBOARD_ADMIN_TOKEN configured on the server.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white mb-4"
            required
          />
          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-red-magic to-blue-magic px-4 py-2.5 text-sm font-bold text-white">
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return <DashboardShell token={token} onSignOut={() => { window.localStorage.removeItem(TOKEN_KEY); setToken(''); }} />;
}

function DashboardShell({ token, onSignOut }) {
  const [tab, setTab] = useState('Overview');
  const api = useAdminApi(token);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sharp-black to-[#150012] text-white">
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Admin dashboard</h1>
          <button onClick={onSignOut} className="text-xs text-white/50 hover:text-white">Sign out</button>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {tab === 'Overview' && <OverviewTab api={api} />}
        {tab === 'Users' && <UsersTab api={api} />}
        {tab === 'Banned wallets' && <BannedWalletsTab api={api} />}
        {tab === 'Game history' && <GameHistoryTab api={api} />}
        {tab === 'Tournaments' && <TournamentsTab api={api} />}
        {tab === 'KOL allocations' && <KolAllocationsTab api={api} />}
      </div>
    </div>
  );
}

function Panel({ children }) {
  return <div className="rounded-2xl border border-white/10 bg-[#1A0015]/60 overflow-hidden">{children}</div>;
}

function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>;
}

function OverviewTab({ api }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api('/api/admin/stats').then(setStats).catch((e) => setError(e.message)); }, [api]);

  return (
    <div>
      <ErrorNote error={error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Tracked wallets" value={stats ? stats.wallets.toLocaleString() : '…'} />
        <Tile label="Total games" value={stats ? stats.totalGames.toLocaleString() : '…'} />
        <Tile label="Wagered" value={stats ? `${fmt(stats.totalWagered)} USDC` : '…'} />
        <Tile label="Paid out" value={stats ? `${fmt(stats.totalPaidOut)} USDC` : '…'} />
        <Tile label="Live streams" value={stats ? stats.liveStreams : '…'} />
        <Tile label="Open tournaments" value={stats ? stats.openTournaments : '…'} />
        <Tile label="Avg session" value={stats ? `${Math.round(stats.avgSessionSeconds / 60)}m` : '…'} />
      </div>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1A0015]/80 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</p>
      <p className="mt-2 text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function UsersTab({ api }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => { api('/api/admin/users').then((j) => setUsers(j.users || [])).catch((e) => setError(e.message)); }, [api]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (wallet, status) => {
    setBusy(wallet);
    try {
      await api('/api/admin/users/status', { method: 'POST', body: JSON.stringify({ wallet, status }) });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <Panel>
      <ErrorNote error={error} />
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
          <tr><th className="px-4 py-3">Wallet</th><th className="px-4 py-3 text-right">Bets</th><th className="px-4 py-3 text-right">Wagered</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.wallet} className="border-t border-white/5">
              <td className="px-4 py-3 font-mono text-xs">{short(u.wallet)}</td>
              <td className="px-4 py-3 text-right">{u.bets}</td>
              <td className="px-4 py-3 text-right">{fmt(u.wagered)} USDC</td>
              <td className="px-4 py-3 capitalize">{u.status}</td>
              <td className="px-4 py-3 text-right">
                {u.status !== 'banned' ? (
                  <button disabled={busy === u.wallet} onClick={() => setStatus(u.wallet, 'banned')} className="rounded-md border border-rose-400/30 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">Ban</button>
                ) : (
                  <button disabled={busy === u.wallet} onClick={() => setStatus(u.wallet, 'active')} className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">Unban</button>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-white/45">No tracked wallets yet.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function BannedWalletsTab({ api }) {
  const [banned, setBanned] = useState([]);
  const [error, setError] = useState(null);
  const [wallet, setWallet] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(() => { api('/api/admin/banned-wallets').then((j) => setBanned(j.banned || [])).catch((e) => setError(e.message)); }, [api]);
  useEffect(() => { load(); }, [load]);

  const ban = async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/banned-wallets', { method: 'POST', body: JSON.stringify({ wallet, reason }) });
      setWallet(''); setReason(''); await load();
    } catch (e2) { setError(e2.message); }
  };

  const unban = async (w) => {
    try { await api('/api/admin/unban-wallet', { method: 'POST', body: JSON.stringify({ wallet: w }) }); await load(); }
    catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <ErrorNote error={error} />
      <form onSubmit={ban} className="mb-4 flex flex-wrap gap-2">
        <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x… wallet" className="flex-1 min-w-[220px] rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" required />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 min-w-[160px] rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
        <button type="submit" className="rounded-lg bg-gradient-to-r from-red-magic to-blue-magic px-4 py-2 text-sm font-bold text-white">Ban wallet</button>
      </form>
      <Panel>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
            <tr><th className="px-4 py-3">Wallet</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {banned.map((b) => (
              <tr key={b.wallet_address} className="border-t border-white/5">
                <td className="px-4 py-3 font-mono text-xs">{short(b.wallet_address)}</td>
                <td className="px-4 py-3 text-white/70">{b.reason || '—'}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => unban(b.wallet_address)} className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">Unban</button></td>
              </tr>
            ))}
            {banned.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-white/45">No banned wallets.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function GameHistoryTab({ api }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => { api('/api/admin/game-history?limit=200').then((j) => setHistory(j.history || [])).catch((e) => setError(e.message)); }, [api]);

  return (
    <Panel>
      <ErrorNote error={error} />
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
          <tr><th className="px-4 py-3">Wallet</th><th className="px-4 py-3">Game</th><th className="px-4 py-3 text-right">Bet</th><th className="px-4 py-3 text-right">Payout</th><th className="px-4 py-3">When</th><th className="px-4 py-3" /></tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id} className="border-t border-white/5">
              <td className="px-4 py-3 font-mono text-xs">{short(h.wallet)}</td>
              <td className="px-4 py-3 capitalize">{h.game}</td>
              <td className="px-4 py-3 text-right">{fmt(h.bet_raw)}</td>
              <td className="px-4 py-3 text-right">{fmt(h.payout_raw)}</td>
              <td className="px-4 py-3 text-xs text-white/55">{new Date(h.created_at).toLocaleString()}</td>
              <td className="px-4 py-3">{h.proof_reference && <a href={basescanUrl('tx', h.proof_reference)} target="_blank" rel="noreferrer" className="text-emerald-300 text-xs hover:underline">Verify</a>}</td>
            </tr>
          ))}
          {history.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/45">No games logged yet.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function TournamentsTab({ api }) {
  const [tournaments, setTournaments] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', game: 'all', prizePool: '', entryFee: '', startsAt: '' });

  const load = useCallback(() => { api('/api/admin/tournaments').then((j) => setTournaments(j.tournaments || [])).catch((e) => setError(e.message)); }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/tournaments', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', game: 'all', prizePool: '', entryFee: '', startsAt: '' });
      await load();
    } catch (e2) { setError(e2.message); }
  };

  const setStatus = async (id, status) => {
    try { await api(`/api/admin/tournaments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); }
    catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <ErrorNote error={error} />
      <form onSubmit={create} className="mb-4 grid gap-2 sm:grid-cols-5">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white sm:col-span-2" required />
        <select value={form.game} onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))} className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white">
          {['all', 'plinko', 'mines', 'roulette', 'wheel'].map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <input type="number" value={form.prizePool} onChange={(e) => setForm((f) => ({ ...f, prizePool: e.target.value }))} placeholder="Prize pool USDC" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
        <input type="number" value={form.entryFee} onChange={(e) => setForm((f) => ({ ...f, entryFee: e.target.value }))} placeholder="Entry fee USDC" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
        <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white sm:col-span-2" required />
        <button type="submit" className="rounded-lg bg-gradient-to-r from-red-magic to-blue-magic px-4 py-2 text-sm font-bold text-white">Create tournament</button>
      </form>
      <Panel>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Prize pool</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.id} className="border-t border-white/5">
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3 capitalize">{t.status}</td>
                <td className="px-4 py-3 text-right">{fmt(t.prize_pool)} USDC</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {t.status !== 'live' && <button onClick={() => setStatus(t.id, 'live')} className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5">Go live</button>}
                  {t.status !== 'completed' && <button onClick={() => setStatus(t.id, 'completed')} className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5">Complete</button>}
                </td>
              </tr>
            ))}
            {tournaments.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-white/45">No tournaments yet.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function KolAllocationsTab({ api }) {
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ kolSlug: '', displayName: '', walletAddress: '', portalPassword: '' });

  const load = useCallback(() => { api('/api/admin/kol-allocations').then((j) => setAllocations(j.allocations || [])).catch((e) => setError(e.message)); }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/kol-allocations', { method: 'POST', body: JSON.stringify(form) });
      setForm({ kolSlug: '', displayName: '', walletAddress: '', portalPassword: '' });
      await load();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <ErrorNote error={error} />
      <form onSubmit={create} className="mb-4 grid gap-2 sm:grid-cols-5">
        <input value={form.kolSlug} onChange={(e) => setForm((f) => ({ ...f, kolSlug: e.target.value }))} placeholder="Slug (/kol/…)" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" required />
        <input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Display name" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" required />
        <input value={form.walletAddress} onChange={(e) => setForm((f) => ({ ...f, walletAddress: e.target.value }))} placeholder="Wallet address" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white sm:col-span-2" required />
        <input value={form.portalPassword} onChange={(e) => setForm((f) => ({ ...f, portalPassword: e.target.value }))} placeholder="Portal password" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" required />
        <button type="submit" className="rounded-lg bg-gradient-to-r from-red-magic to-blue-magic px-4 py-2 text-sm font-bold text-white sm:col-span-5">Create allocation</button>
      </form>
      <Panel>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
            <tr><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Wallet</th></tr>
          </thead>
          <tbody>
            {allocations.map((a) => (
              <tr key={a.id} className="border-t border-white/5">
                <td className="px-4 py-3 font-mono text-xs">/kol/{a.kol_slug}</td>
                <td className="px-4 py-3">{a.display_name}</td>
                <td className="px-4 py-3 capitalize">{a.status}</td>
                <td className="px-4 py-3 font-mono text-xs">{short(a.wallet_address)}</td>
              </tr>
            ))}
            {allocations.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-white/45">No KOL allocations yet.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
