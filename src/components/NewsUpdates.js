import Link from 'next/link';

const updates = [
  ['Inco Lightning', 'Confidential randomness and attested reveal power all four games.', '/fairness'],
  ['Megapot rewards', 'Gameplay credits are redeemable for a functional testnet ticket NFT.', '/jackpot'],
  ['Base Sepolia', 'Casino and reward vault contracts are deployed and fully smoke-tested.', '/fairness'],
];

export default function NewsUpdates() {
  return <section id="roadmap" className="roadmap-section px-4 py-16 md:px-8 md:py-20 lg:px-16"><div className="mx-auto max-w-7xl"><div className="mb-10 text-center"><p className="text-[10px] font-black uppercase tracking-[.3em] text-white/35">Build status</p><h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">Protocol updates</h2></div><div className="grid gap-5 md:grid-cols-3">{updates.map(([title,text,href])=><Link key={title} href={href} className="roadmap-glass group rounded-2xl p-6 transition hover:-translate-y-1 hover:border-fuchsia-400/30"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)] inline-block"/><h3 className="mt-5 font-display text-xl font-bold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-white/50">{text}</p><span className="mt-6 inline-flex text-sm font-bold text-fuchsia-300 group-hover:text-white">Learn more →</span></Link>)}</div></div></section>;
}
