'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import ProfileDashboard from '@/components/profile/ProfileDashboard';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const balance = useBalance({ address, query: { enabled: Boolean(address) } });

  const [profile, setProfile] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/profile?wallet=${encodeURIComponent(address)}`),
        fetch(`/api/referrals/stats?wallet=${encodeURIComponent(address)}`),
      ]);
      const pJson = await pRes.json().catch(() => null);
      const sJson = await sRes.json().catch(() => null);
      if (pRes.ok) setProfile(pJson);
      if (sRes.ok) setReferralStats(sJson);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const refreshGames = useCallback(async () => {
    if (!address) return;
    setLoadingGames(true);
    try {
      const r = await fetch(`/api/profile/games?wallet=${encodeURIComponent(address)}&limit=50`);
      const j = await r.json().catch(() => null);
      if (r.ok) setGames(j);
    } finally {
      setLoadingGames(false);
    }
  }, [address]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void refreshGames(); }, [refreshGames]);

  return (
    <ProfileDashboard
      connected={isConnected}
      address={address}
      balanceNative={balance.data?.formatted}
      nativeLabel={balance.data?.symbol || 'ETH'}
      profile={profile}
      games={games}
      referralStats={referralStats}
      loading={loading}
      loadingGames={loadingGames}
      onRefresh={refresh}
      onRefreshGames={refreshGames}
      onSavedProfile={refresh}
    />
  );
}
