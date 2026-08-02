'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectWalletButton from '@/components/ConnectWalletButton';

const links = [
  ['/game', 'Games'],
  ['/jackpot', 'Megapot'],
  ['/fairness', 'Fairness'],
  ['/docs', 'Docs'],
];

export default function Navbar() {
  const pathname = usePathname();
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070005]/95 text-white backdrop-blur-xl"><div className="site-page-pad-x mx-auto flex h-[6.25rem] max-w-[1480px] items-center gap-5"><Link href="/" className="shrink-0"><Image src="/PowerPlay.png" alt="AptCasino" width={172} height={40} className="h-auto w-[150px] sm:w-[172px]" priority /></Link><nav className="ml-auto hidden items-center gap-1 lg:flex">{links.map(([href,label])=><Link key={href} href={href} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${pathname.startsWith(href)?'bg-white/10 text-white':'text-white/60 hover:bg-white/5 hover:text-white'}`}>{label}</Link>)}</nav><div className="ml-auto lg:ml-2"><ConnectWalletButton /></div></div><div className="hero-alert-marquee-inner h-[2.875rem] border-t border-white/[.06] bg-[#0d000b]"><div className="hero-alert-marquee-fade hero-alert-marquee-fade--left"/><div className="hero-alert-marquee-track text-sm text-white/65"><span className="hero-alert-marquee-item">● Base Sepolia testnet live</span><span className="hero-alert-marquee-item">Inco Lightning confidential randomness</span><span className="hero-alert-marquee-item">Megapot tickets earned through gameplay</span><span className="hero-alert-marquee-item">Four attested games verified on-chain</span><span className="hero-alert-marquee-item">● Base Sepolia testnet live</span><span className="hero-alert-marquee-item">Inco Lightning confidential randomness</span><span className="hero-alert-marquee-item">Megapot tickets earned through gameplay</span></div><div className="hero-alert-marquee-fade hero-alert-marquee-fade--right"/></div><nav className="flex overflow-x-auto border-t border-white/[.05] bg-[#070005] px-3 py-2 lg:hidden">{links.map(([href,label])=><Link key={href} href={href} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${pathname.startsWith(href)?'bg-white/10 text-white':'text-white/55'}`}>{label}</Link>)}</nav></header>;
}
