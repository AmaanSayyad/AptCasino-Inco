'use client';

import Link from 'next/link';
import { FaQuoteLeft, FaTrophy } from 'react-icons/fa';

const rounds = [
  { game: 'Roulette', result: '0.000485 ETH payout', tx: '0x420138a6f1409c3b0584ef40d03c00e7e6bd801c8c4f65405db70a9dfc37c08f' },
  { game: 'Wheel', result: '0.0001875 ETH payout', tx: '0x1c72bf2da77298cb8ff9dffb5d809758d8a718e5f094162f0bc85b4ab8792fe7' },
  { game: 'Plinko', result: '0.0002 ETH payout', tx: '0x238c472443a7fc6ff545d59fc6f0dc0130ef9ce706e259870af7424450670295' },
  { game: 'Mines', result: 'Attested mine reveal', tx: '0x3b39a2ba286462cc4dad7163b3151484ba7aca1f8c19650e6582df2951c40642' },
];

export default function TestimonialsSection() {
  const featured = rounds[0];
  return (
    <section className="relative overflow-hidden px-4 py-16 md:px-8 lg:px-16">
      <div className="absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-red-magic/5 blur-[100px]" />
      <div className="absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-blue-magic/5 blur-[100px]" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-3 flex items-center justify-center"><div className="mr-3 h-6 w-1 rounded-full bg-gradient-to-r from-red-magic to-blue-magic" /><h2 className="font-display text-2xl font-bold text-white">Verified confidential rounds</h2></div>
        <p className="mx-auto mb-12 max-w-2xl text-center text-sm text-white/55">Real Base Sepolia settlements produced from Inco Lightning attestations. Every link opens the final on-chain transaction.</p>
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="rounded-xl bg-gradient-to-r from-red-magic to-blue-magic p-[1px]"><div className="relative h-full rounded-xl bg-[#1A0015] p-6 md:p-8"><FaQuoteLeft className="absolute right-4 top-4 text-6xl text-red-magic/20" /><div className="mb-6 flex items-center"><div className="mr-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-red-magic/40 to-blue-magic/40"><FaTrophy className="text-amber-200" /></div><div><p className="font-display text-xl font-bold text-white">{featured.game}</p><p className="text-xs text-white/50">Inco attested settlement</p></div></div><p className="text-lg text-white/80">The hidden result was revealed and settled for <span className="font-semibold text-amber-200">{featured.result}</span>.</p><Link href={`https://sepolia.basescan.org/tx/${featured.tx}`} target="_blank" className="mt-6 inline-flex text-sm font-bold text-fuchsia-300 hover:text-white">Verify on BaseScan →</Link></div></div>
          <div className="space-y-3">{rounds.map((round,index)=><Link key={round.tx} href={`https://sepolia.basescan.org/tx/${round.tx}`} target="_blank" className={`flex items-center rounded-lg p-4 transition ${index===0?'border-l-2 border-red-magic bg-gradient-to-r from-red-magic/20 to-blue-magic/20':'hover:bg-[#250020]/30'}`}><div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#250020] text-sm font-semibold text-amber-200">#{index+1}</div><div><p className="font-medium text-white">{round.game}</p><p className="text-xs text-white/55">{round.result}</p></div><span className="ml-auto text-sm text-white/40">BaseScan</span></Link>)}</div>
        </div>
      </div>
    </section>
  );
}
