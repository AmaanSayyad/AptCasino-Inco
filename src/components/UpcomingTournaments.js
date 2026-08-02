'use client';

import Link from 'next/link';
import { FaTicketAlt, FaTrophy, FaUsers } from 'react-icons/fa';

const milestones = [
  ['Play', 'Complete any confidential round'],
  ['Settle', 'Verify the Inco attestation on Base'],
  ['Earn', 'Receive gameplay credits automatically'],
  ['Claim', 'Redeem 1,000 credits for a Megapot ticket'],
];

export default function UpcomingTournaments() {
  return <section className="relative overflow-hidden px-4 py-16 md:px-8 lg:px-16"><div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-950/10 to-transparent" /><div className="relative z-10 mx-auto max-w-7xl"><div className="mb-10 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.3em] text-fuchsia-300/60">Community jackpot</p><h2 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Megapot progression</h2><p className="mt-2 max-w-2xl text-sm text-white/50">The reward system is embedded in every game instead of living on a separate promotion page.</p></div><FaTrophy className="hidden text-5xl text-amber-300/60 sm:block" /></div><div className="grid gap-4 md:grid-cols-4">{milestones.map(([title,text],index)=><div key={title} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center justify-between"><span className="font-display text-xs font-black text-white/30">0{index+1}</span>{index===3?<FaTicketAlt className="text-fuchsia-300"/>:<FaUsers className="text-white/25"/>}</div><h3 className="mt-5 font-display text-xl font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-white/50">{text}</p></div>)}</div><div className="mt-8 flex justify-center"><Link href="/jackpot" className="rounded-xl bg-gradient-to-r from-red-magic to-blue-magic px-7 py-3 text-sm font-black uppercase tracking-widest text-white">View Megapot vault</Link></div></div></section>;
}
