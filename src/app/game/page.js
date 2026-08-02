import Link from 'next/link';

const games = [
  { slug: 'roulette', title: 'Roulette', text: 'A sealed winning number, revealed only after your wager is locked.', color: 'from-red-500 to-rose-800' },
  { slug: 'wheel', title: 'Wheel', text: 'An encrypted landing segment drives the verified wheel animation.', color: 'from-violet-500 to-fuchsia-800' },
  { slug: 'plinko', title: 'Plinko', text: 'The contract chooses a confidential path; physics replays the result.', color: 'from-cyan-500 to-blue-800' },
  { slug: 'mines', title: 'Mines', text: 'Pick tiles against a mine map that never exists in browser memory.', color: 'from-amber-400 to-orange-800' },
];

export const metadata = { title: 'Confidential Games | AptCasino', description: 'Four Inco Lightning games with Megapot rewards on Base Sepolia.' };

export default function GamesPage() {
  return <main className="min-h-screen bg-[#080812] px-5 py-16 text-white"><div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">Inco Lightning × Megapot</p><h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-tight sm:text-7xl">Four games. Hidden outcomes. Real jackpot tickets.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">Every game settles on Base Sepolia with an Inco covalidator attestation. Completed rounds earn progress toward Megapot ticket NFTs.</p><div className="mt-12 grid gap-5 md:grid-cols-2">{games.map((game) => <Link key={game.slug} href={`/game/${game.slug}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-[#11111d] transition hover:-translate-y-1 hover:border-white/25"><div className={`h-2 bg-gradient-to-r ${game.color}`} /><div className="p-7"><span className="text-xs font-bold uppercase tracking-widest text-white/35">Confidential game</span><h2 className="mt-3 text-3xl font-black">{game.title}</h2><p className="mt-3 leading-7 text-white/55">{game.text}</p><span className="mt-7 inline-block font-bold text-white">Play on testnet →</span></div></Link>)}</div></div></main>;
}
