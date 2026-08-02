import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#07070e]">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-xl font-black text-white">AptCasino</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Confidential casino games powered by Inco Lightning, with Megapot tickets earned inside the game loop. Base Sepolia testnet only.</p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-white/60">
          <Link href="/game" className="hover:text-white">Games</Link>
          <Link href="/jackpot" className="hover:text-white">Megapot</Link>
          <Link href="/docs" className="hover:text-white">Docs</Link>
          <a href="https://sepolia.basescan.org" target="_blank" rel="noreferrer" className="hover:text-white">BaseScan</a>
        </div>
      </div>
    </footer>
  );
}
