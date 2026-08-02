import GameCarousel from '@/components/GameCarousel';
import Link from 'next/link';

const games = [
  ['Roulette', 'Classic number, color, parity, range, dozen and column bets.', '/game/roulette'],
  ['Mines', 'Choose safe tiles before the confidential mine map is revealed.', '/game/mines'],
  ['Spin Wheel', 'Pick a risk level and settle the hidden Inco segment.', '/game/wheel'],
  ['Plinko', 'Select rows and risk, then replay the verified bucket.', '/game/plinko'],
];

export default function Page() {
  return <div className="site-game-page min-h-[100dvh] bg-gradient-to-b from-sharp-black to-[#150012] text-white"><div className="site-page-top site-page-pad-x container mx-auto pb-10 md:pb-16"><div className="mb-6 md:mb-10"><GameCarousel /></div><section className="mx-auto max-w-7xl"><div className="mb-6 flex items-center"><div className="mr-3 h-6 w-1 rounded-full bg-gradient-to-r from-red-magic to-blue-magic"/><h2 className="font-display text-2xl font-bold">Live confidential games</h2></div><div className="grid gap-4 md:grid-cols-2">{games.map(([title,text,href])=><Link key={href} href={href} className="group rounded-2xl border border-white/10 bg-white/[.035] p-6 transition hover:border-fuchsia-400/30 hover:bg-white/[.055]"><div className="flex items-center justify-between"><h3 className="font-display text-xl font-bold">{title}</h3><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-300">LIVE</span></div><p className="mt-3 text-sm leading-6 text-white/50">{text}</p><span className="mt-5 inline-flex text-sm font-bold text-fuchsia-300 group-hover:text-white">Play on Base Sepolia →</span></Link>)}</div></section></div></div>;
}
