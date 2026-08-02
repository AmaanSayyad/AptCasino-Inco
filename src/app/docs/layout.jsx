import Link from 'next/link';

const sections = [
  ['Overview', '/docs'], ['Inco Lightning', '/docs/inco'], ['Megapot rewards', '/docs/megapot'], ['System architecture', '/docs/architecture'], ['Testnet deployment', '/docs/deployment'],
];

export default function DocsLayout({ children }) {
  return <div className="min-h-screen bg-[#080812] text-white"><div className="mx-auto grid max-w-7xl lg:grid-cols-[250px_1fr]"><aside className="border-r border-white/10 px-5 py-8 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]"><Link href="/docs" className="text-lg font-black">AptCasino Docs</Link><p className="mt-1 text-xs text-white/40">Base Sepolia · testnet</p><nav className="mt-7 space-y-1">{sections.map(([label, href]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">{label}</Link>)}</nav><div className="mt-8 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-xs leading-5 text-white/60"><strong className="block text-fuchsia-200">Live architecture</strong>All diagrams describe the contracts and frontend shipped in this repository.</div></aside><article className="min-w-0 px-5 py-10 sm:px-10 lg:px-14">{children}</article></div></div>;
}
