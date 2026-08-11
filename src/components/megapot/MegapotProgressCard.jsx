'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaTicketAlt, FaExternalLinkAlt } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';
import { BRAND_LOGOS } from '@/lib/brandLogos';

/**
 * Shared Megapot meter used on all four game pages.
 * Pass fields from useMegapotCredits / useConfidentialGame / useMinesSession.
 */
export default function MegapotProgressCard({
  credits = 0,
  vaultConfigured = false,
  canClaim = false,
  claimPending = false,
  claimReceiptLoading = false,
  claimSucceeded = false,
  claimTicketId,
  claimTxHash,
  claimError,
  onClaim,
  className = '',
}) {
  const progress = Math.min(100, (Number(credits) || 0) / 10);
  const busy = claimPending || claimReceiptLoading;

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-[#120010] to-white/[0.02] p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-magic/30 to-blue-magic/30 ring-1 ring-white/10">
              <FaTicketAlt className="text-fuchsia-200" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Megapot progress</p>
              <p className="font-display text-sm font-semibold text-white/80">Earn credits by settling rounds</p>
            </div>
          </div>
        </div>
        <Link
          href="/jackpot"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-2.5 py-1 transition hover:opacity-90"
          title="Open Megapot page"
        >
          <Image src={BRAND_LOGOS.megapot.src} alt={BRAND_LOGOS.megapot.alt} width={72} height={18} className="h-4 w-auto object-contain" />
        </Link>
      </div>

      <p className="mt-5 font-display text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {Number(credits) || 0}
        <span className="ml-2 text-base font-semibold text-white/35 sm:text-lg">/ 1000 credits</span>
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-magic to-blue-magic transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/40">
        {canClaim ? 'Ready to claim a Megapot ticket NFT.' : `${Math.max(0, 1000 - (Number(credits) || 0))} credits to the next ticket.`}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!vaultConfigured || !canClaim || busy}
          onClick={() => onClaim?.()}
          className="rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Minting ticket…' : 'Claim Megapot ticket'}
        </button>
        <Link
          href="/jackpot"
          className="text-xs font-bold uppercase tracking-wider text-fuchsia-300 hover:text-fuchsia-200"
        >
          How rewards work →
        </Link>
      </div>

      {claimSucceeded && (
        <p className="mt-3 text-sm text-emerald-300">
          Ticket claimed{claimTicketId ? ` (#${claimTicketId})` : ''} —{' '}
          {claimTxHash ? (
            <a
              href={basescanUrl('tx', claimTxHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline hover:text-emerald-200"
            >
              view on BaseScan <FaExternalLinkAlt className="text-[10px]" />
            </a>
          ) : (
            'minted to your wallet.'
          )}
        </p>
      )}
      {claimError && <p className="mt-3 text-sm text-red-300">{claimError}</p>}
    </section>
  );
}
