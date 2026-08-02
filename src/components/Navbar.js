'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectWalletButton from '@/components/ConnectWalletButton';

const links = [
  { href: '/game', label: 'Games' },
  { href: '/jackpot', label: 'Megapot' },
  { href: '/docs', label: 'Docs' },
  { href: '/fairness', label: 'Fairness' },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080812]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="AptCasino home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-red-500 to-fuchsia-600 font-black text-white">A</span>
          <span className="font-display text-lg font-black tracking-tight text-white">AptCasino</span>
          <span className="hidden rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-200 sm:inline">Base Sepolia</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${pathname?.startsWith(link.href) ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <ConnectWalletButton />
      </div>
    </header>
  );
}
