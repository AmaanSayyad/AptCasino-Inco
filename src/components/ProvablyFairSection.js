'use client';

import Link from 'next/link';
import { FaLock, FaCheckCircle, FaExternalLinkAlt } from 'react-icons/fa';

const steps = [
  ['Encrypted draw', 'The contract requests a confidential random value from Inco Lightning.'],
  ['Private round', 'The result remains sealed while the player wager is locked on Base Sepolia.'],
  ['Attested reveal', 'An Inco covalidator signature authorizes the public reveal.'],
  ['Trustless settlement', 'The casino contract calculates payout and Megapot credits on-chain.'],
];

export default function ProvablyFairSection() {
  return <section className="relative overflow-hidden px-4 py-16 md:px-8 lg:px-16"><div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-red-magic/5 blur-[110px]"/><div className="relative z-10 mx-auto max-w-7xl"><div className="mb-10 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-magic/30 to-blue-magic/30 ring-1 ring-white/10"><FaLock className="text-fuchsia-200"/></div><h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Confidential, then verifiable</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">The old provably-fair visual language stays intact; Inco Lightning now supplies the hidden randomness and attested reveal.</p></div><div className="grid gap-4 md:grid-cols-4">{steps.map(([title,text],index)=><div key={title} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.06] to-white/[.02] p-5"><div className="flex items-center justify-between"><span className="font-display text-xs font-black text-white/30">0{index+1}</span><FaCheckCircle className="text-emerald-400/70"/></div><h3 className="mt-5 font-display text-lg font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-white/50">{text}</p></div>)}</div><div className="mt-8 flex justify-center"><Link href="/fairness" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-6 py-3 text-sm font-bold text-white hover:bg-white/10">Inspect fairness flow <FaExternalLinkAlt className="text-xs"/></Link></div></div></section>;
}
