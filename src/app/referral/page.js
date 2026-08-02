'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayWallet } from '@/lib/hooks/usePlayWallet';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import {
  FaCopy,
  FaCheck,
  FaTwitter,
  FaTelegram,
  FaWhatsapp,
  FaFacebookF,
  FaLinkedin,
  FaReddit,
  FaDiscord,
  FaEnvelope,
  FaTrophy,
  FaGift,
  FaShareAlt,
  FaLink,
  FaCheckCircle,
} from 'react-icons/fa';
import PageShell, { PageCard, SectionHeading } from '@/components/layout/PageShell';
import ReferralLinkCard from '@/components/referral/ReferralLinkCard';
import { buildReferralShortLink, getPublicShareOrigin } from '@/lib/siteMetadata';
import { getReferralBroadcastMessage } from '@/lib/referral/shareMessage';
import {
  APT_CASINO_DISCORD_INVITE,
  buildReferralShareChannels,
  getLinkedInShareUrl,
  getReferralLinkedInPost,
  getReferralLinkForPreview,
  getReferralTweetText,
} from '@/lib/referral/shareIntents';

function short(addr) {
  if (!addr) return '—';
  const s = String(addr);
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function fmtDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function ordinal(n) {
  if (n === null || n === undefined) return '—';
  const v = Math.abs(n) % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (v % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function fmtReward(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const HOW_IT_WORKS = [
  { icon: <FaShareAlt className="text-blue-magic" />, title: 'Share your link', body: 'Copy the hype message or blast it on X / TG / WA — the ref saves automatically when they land.' },
  { icon: <FaCheckCircle className="text-emerald-300" />, title: 'Friend plays', body: 'Once your referee is attributed to your code, their activity counts toward your referral stats.' },
  { icon: <FaGift className="text-pink-300" />, title: 'Rewards tracked', body: 'Referral rewards are tracked here and paid out manually while the on-chain reward path is built.' },
];

export default function ReferralsPage() {
  const { connected, address } = usePlayWallet();

  const [code, setCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);

  const publicOrigin = getPublicShareOrigin();

  const referralLinkShort = useMemo(
    () => (code ? buildReferralShortLink(code) : ''),
    [code],
  );
  const referralLinkPreview = useMemo(
    () => getReferralLinkForPreview(referralLinkShort),
    [referralLinkShort],
  );
  const referralLinkQuery = useMemo(
    () => (code ? `${publicOrigin}/?ref=${code}` : ''),
    [code, publicOrigin],
  );

  const refreshLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      const r = await fetch('/api/referrals/leaderboard?limit=50');
      const j = await r.json().catch(() => ({}));
      setLeaderboard(r.ok ? (j.leaderboard || []) : []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    if (!address) {
      setStats(null);
      return;
    }
    setLoadingStats(true);
    try {
      const r = await fetch(`/api/referrals/stats?wallet=${encodeURIComponent(address)}`);
      const j = await r.json().catch(() => ({}));
      setStats(r.ok ? j : null);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [address]);

  const refreshConfig = useCallback(async () => {
    try {
      const r = await fetch('/api/referrals/config');
      const j = await r.json();
      if (r.ok) setConfig(j);
    } catch {
      /* ignore */
    }
  }, []);

  const ensureCode = useCallback(async () => {
    if (!address) return;
    setLoadingCode(true);
    setError(null);
    try {
      const r = await fetch(`/api/referrals/code?wallet=${encodeURIComponent(address)}`);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.code) {
        setCode(j.code);
      } else {
        setError(j.error || 'Could not load or generate your referral code.');
      }
    } catch {
      setError('Network error while loading your referral code.');
    } finally {
      setLoadingCode(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshConfig();
    void refreshLeaderboard();
    const id = setInterval(refreshLeaderboard, 60_000);
    return () => clearInterval(id);
  }, [refreshLeaderboard, refreshConfig]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (connected && address) {
      void ensureCode();
    } else {
      setCode(null);
    }
  }, [connected, address, ensureCode]);

  const broadcastMessage = useMemo(
    () => getReferralBroadcastMessage(referralLinkShort),
    [referralLinkShort],
  );

  const handleCopy = useCallback(
    async (which) => {
      let value = which === 'query' ? referralLinkQuery : referralLinkShort;
      if (which === 'message') value = broadcastMessage;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(which);
        setTimeout(() => setCopied(null), 1800);
      } catch {
        /* ignore */
      }
    },
    [referralLinkQuery, referralLinkShort, broadcastMessage],
  );

  const tweetIntent = useMemo(() => {
    if (!referralLinkShort) return null;
    const text = encodeURIComponent(getReferralTweetText());
    const url = encodeURIComponent(referralLinkShort);
    return `https://x.com/intent/post?text=${text}&url=${url}`;
  }, [referralLinkShort]);

  const shareChannels = useMemo(
    () =>
      buildReferralShareChannels({
        referralLink: referralLinkShort,
        tweetIntent,
      }),
    [referralLinkShort, tweetIntent],
  );

  const handleDiscordShare = useCallback(async () => {
    if (!broadcastMessage) return;
    try {
      await navigator.clipboard.writeText(broadcastMessage);
      setCopied('discord');
      setTimeout(() => setCopied(null), 1800);
      window.open(APT_CASINO_DISCORD_INVITE, '_blank', 'noopener,noreferrer');
    } catch {
      /* ignore */
    }
  }, [broadcastMessage]);

  const handleLinkedInShare = useCallback(async () => {
    const preview = referralLinkPreview || referralLinkShort;
    if (!preview) return;
    const linkedInUrl = getLinkedInShareUrl(preview);
    if (!linkedInUrl) return;
    try {
      await navigator.clipboard.writeText(getReferralLinkedInPost(preview));
      setCopied('linkedin');
      setTimeout(() => setCopied(null), 1800);
      window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
    }
  }, [referralLinkPreview, referralLinkShort]);

  const myRow = useMemo(
    () => (address ? leaderboard.find((r) => r.wallet?.toLowerCase() === address.toLowerCase()) : null),
    [leaderboard, address],
  );

  return (
    <PageShell
      badge="Referrals"
      title="Referrals"
      description={config?.description || 'Share your link. Referral rewards are tracked here and paid out manually while the on-chain reward path is built.'}
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Referrals' }]}
    >
      <section className="grid gap-4 sm:grid-cols-3 mb-10">
        <SummaryTile
          icon={<FaCheckCircle className="text-emerald-300" />}
          label="Valid referrals"
          value={!connected ? '—' : loadingStats ? '…' : String(stats?.validReferrals ?? 0)}
          hint={connected ? `${stats?.totalReferrals ?? 0} total invited` : 'Connect your wallet'}
        />
        <SummaryTile
          icon={<FaGift className="text-pink-300" />}
          label="Rewards tracked"
          value={!connected ? '—' : loadingStats ? '…' : fmtReward(stats?.earnedRaw ?? 0)}
          hint="Manual payout for now"
        />
        <SummaryTile
          icon={<FaTrophy className="text-amber-300" />}
          label="Your rank"
          value={!connected ? '—' : myRow?.rank ? ordinal(myRow.rank) : 'Unranked'}
          hint="Top 50 leaderboard"
        />
      </section>

      <section id="referral-leaderboard" className="mb-10 scroll-mt-24">
        <SectionHeading
          icon={<FaTrophy className="text-amber-300" />}
          title="Public referral leaderboard"
          subtitle="Anyone can view this — ranked by people invited. Validated = at least one attributed referee."
          action={
            <span className="text-xs text-white/45 tabular-nums">
              {loadingBoard ? 'Updating…' : `${leaderboard.length} referrers`}
            </span>
          }
        />
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1A0015]/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
                <tr>
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3">Referrer</th>
                  <th className="px-4 py-3 text-right">Invited</th>
                  <th className="px-4 py-3 text-right">Validated</th>
                  <th className="px-4 py-3 text-right">Rewards</th>
                  <th className="px-4 py-3">Latest</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-white/45 text-center" colSpan={6}>
                      {loadingBoard
                        ? 'Loading leaderboard…'
                        : 'No referrals yet. Share your link — you appear here once someone signs up with it.'}
                    </td>
                  </tr>
                )}
                {leaderboard.map((row) => {
                  const isYou = Boolean(address && row.wallet?.toLowerCase() === address.toLowerCase());
                  return (
                    <tr
                      key={row.wallet}
                      className={`border-t border-white/5 ${isYou ? 'bg-purple-500/5 text-white' : 'text-white/80'}`}
                    >
                      <td className="px-4 py-3 font-bold">
                        <RankBadge rank={row.rank} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[11px] text-white/70">{short(row.wallet)}</p>
                        {isYou && (
                          <span className="mt-1 inline-block rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-magic">
                        {Number(row.total_referrals ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-300">
                        {Number(row.referrals ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-300">
                        {fmtReward(row.earned_raw)}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/55">{fmtDate(row.last_referral_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4 mb-10">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="w-10 h-10 rounded-full bg-[#250020] flex items-center justify-center mb-3">
              {step.icon}
            </div>
            <p className="font-semibold text-white text-sm">{step.title}</p>
            <p className="text-xs text-white/50 mt-2 leading-relaxed">{step.body}</p>
          </div>
        ))}
      </section>

      <PageCard className="mb-10" gradient="from-red-magic/50 via-fuchsia-500/30 to-blue-magic/50">
        <SectionHeading
          icon={<FaLink className="text-blue-magic" />}
          title="Your referral link"
          subtitle="Recipients tap your link — we store the referral in the browser, then attribute it once they connect a wallet."
          action={
            code ? (
              <span className="rounded-full bg-purple-500/15 border border-purple-400/30 px-3 py-1 text-xs font-mono tracking-wider text-purple-200">
                {code}
              </span>
            ) : null
          }
        />

        {!connected ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/15 p-5 text-sm text-amber-200">
            <p>Connect your wallet to mint your unique referral code.</p>
            <div className="mt-4"><ConnectWalletButton /></div>
          </div>
        ) : loadingCode && !code ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-white/60 animate-pulse">
            Allocating your unique code…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : (
          <>
            <ReferralLinkCard
              link={referralLinkShort}
              code={code}
              copied={copied}
              onCopyLink={() => handleCopy('short')}
              onCopyMessage={() => handleCopy('message')}
            />

            {shareChannels.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10 space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
                    Quick share
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {shareChannels
                      .filter((c) => c.tier === 'primary')
                      .map((channel) => (
                        <SharePill
                          key={channel.id}
                          href={channel.href}
                          onClick={
                            channel.action === 'copy-discord' ? handleDiscordShare : undefined
                          }
                          icon={shareChannelIcon(channel.id, false)}
                          label={channel.shortLabel || channel.label}
                          accent={channel.id}
                        />
                      ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
                    More platforms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shareChannels
                      .filter((c) => c.tier === 'more')
                      .map((channel) => (
                        <ShareIconChip
                          key={channel.id}
                          href={channel.href}
                          onClick={
                            channel.action === 'copy-discord'
                              ? handleDiscordShare
                              : channel.action === 'copy-linkedin'
                                ? handleLinkedInShare
                                : undefined
                          }
                          icon={shareChannelIcon(
                            channel.id,
                            (copied === 'discord' && channel.id === 'discord') ||
                              (copied === 'linkedin' && channel.id === 'linkedin'),
                          )}
                          label={
                            channel.id === 'discord' && copied === 'discord'
                              ? 'Copied'
                              : channel.id === 'linkedin' && copied === 'linkedin'
                                ? 'Copied'
                                : channel.shortLabel || channel.label
                          }
                          accent={channel.id}
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}

            {referralLinkQuery && referralLinkQuery !== referralLinkShort && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Alternate URL (same tracking)
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-relaxed text-white/70 sm:text-sm">
                  {referralLinkQuery}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy('query')}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                >
                  {copied === 'query' ? (
                    <>
                      <FaCheck /> Copied
                    </>
                  ) : (
                    <>
                      <FaCopy /> Copy alternate
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </PageCard>

      <PageCard gradient="from-pink-500/40 to-amber-400/40" className="mb-10">
        <SectionHeading icon={<FaGift className="text-pink-300" />} title="Referral competition · Prize pool" />
        <p className="text-white/70 text-sm max-w-3xl leading-relaxed">
          On top of the reward tracking above, we&apos;ll seed a recurring prize pool for top referrers. Wallets at the
          top of this leaderboard at each window close split the pot pro-rata to validated referral count.
        </p>
        <ul className="mt-4 text-sm text-white/55 space-y-2 list-disc list-inside">
          <li>Only validated referrals (at least one attributed referee) count.</li>
          <li>Self-referrals and duplicates are rejected at the database level.</li>
          <li>Reward payouts are independent of the prize pool — you get both.</li>
        </ul>
      </PageCard>
    </PageShell>
  );
}

function SummaryTile({ icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1A0015]/80 p-4 hover:border-white/20 transition-colors">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/45">
        {icon} <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-white/40">{hint}</p>
    </div>
  );
}

const SHARE_ICONS = {
  x: FaTwitter,
  telegram: FaTelegram,
  whatsapp: FaWhatsapp,
  facebook: FaFacebookF,
  linkedin: FaLinkedin,
  reddit: FaReddit,
  email: FaEnvelope,
  discord: FaDiscord,
};

const SHARE_ACCENT = {
  x: 'text-white group-hover:text-white',
  telegram: 'text-sky-400',
  whatsapp: 'text-emerald-400',
  facebook: 'text-blue-400',
  linkedin: 'text-sky-300',
  reddit: 'text-orange-400',
  email: 'text-white/70',
  discord: 'text-indigo-300',
};

function shareChannelIcon(id, discordCopied) {
  const Icon = SHARE_ICONS[id] || FaShareAlt;
  if ((id === 'discord' || id === 'linkedin') && discordCopied) {
    return <FaCheck className="text-emerald-400" />;
  }
  return <Icon />;
}

function SharePill({ href, onClick, icon, label, accent }) {
  const iconTone = SHARE_ACCENT[accent] || 'text-white/80';
  const shell =
    'w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/90 transition-all hover:border-white/20 hover:bg-white/[0.08]';
  const inner = (
    <>
      <span className={`text-base ${iconTone}`}>{icon}</span>
      <span>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {inner}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={shell}>
      {inner}
    </a>
  );
}

function ShareIconChip({ href, onClick, icon, label, accent }) {
  const iconTone = SHARE_ACCENT[accent] || 'text-white/70';
  const shell =
    'group inline-flex flex-col items-center gap-1.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-white/10 hover:bg-white/[0.04]';
  const inner = (
    <>
      <span
        className={`w-11 h-11 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center text-lg transition-colors group-hover:border-white/20 group-hover:bg-white/[0.06] ${iconTone}`}
      >
        {icon}
      </span>
      <span className="text-[10px] font-medium text-white/45 group-hover:text-white/65 max-w-[4.5rem] truncate">
        {label}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell} title={label}>
        {inner}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={shell} title={label}>
      {inner}
    </a>
  );
}

function RankBadge({ rank }) {
  if (!rank) return <span className="text-white/40">—</span>;
  const palette =
    rank === 1
      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
      : rank === 2
        ? 'bg-zinc-300/15 border-zinc-300/40 text-zinc-200'
        : rank === 3
          ? 'bg-orange-700/20 border-orange-500/40 text-orange-200'
          : 'bg-white/5 border-white/15 text-white/70';
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] rounded-full border px-2 py-0.5 text-xs font-bold ${palette}`}
    >
      #{rank}
    </span>
  );
}
