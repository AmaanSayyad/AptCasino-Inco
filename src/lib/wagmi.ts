import { createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { fallback, http } from 'viem';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS } from '@/lib/baseSepolia';

export const wagmiConfig = createConfig({
  chains: [APTCASINO_CHAIN],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [APTCASINO_CHAIN.id]: fallback(
      BASE_SEPOLIA_RPC_URLS.map((url) => http(url, { retryCount: 2, timeout: 15_000 })),
      { rank: false },
    ),
  },
  pollingInterval: 30_000,
  ssr: true,
});
