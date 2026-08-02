export function DocPage({ eyebrow, title, lead, children }) { return <div className="mx-auto max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-300">{eyebrow}</p><h1 className="mt-4 font-display text-4xl font-black sm:text-6xl">{title}</h1><p className="mt-5 text-lg leading-8 text-white/60">{lead}</p><div className="docs-prose mt-10 space-y-7">{children}</div></div>; }
export function H2({ children }) { return <h2 className="pt-5 text-2xl font-black text-white">{children}</h2>; }
export function P({ children }) { return <p className="leading-7 text-white/65">{children}</p>; }
export function Note({ children }) { return <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5 text-sm leading-6 text-blue-100">{children}</div>; }
export function Code({ children }) { return <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-fuchsia-200">{children}</code>; }
