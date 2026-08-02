'use client';

import { useEffect, useId, useState } from 'react';

export default function MermaidDiagram({ chart, title }) {
  const reactId = useId();
  const id = `mermaid-${reactId.replace(/:/g, '')}`;
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', themeVariables: { primaryColor: '#6d28d9', primaryTextColor: '#fff', lineColor: '#a78bfa', background: '#11111d' } });
      try {
        const rendered = await mermaid.render(id, chart);
        if (active) setSvg(rendered.svg);
      } catch (renderError) {
        if (active) setError(renderError instanceof Error ? renderError.message : 'Diagram could not render');
      }
    });
    return () => { active = false; };
  }, [chart, id]);

  return <figure className="my-7 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0b15] p-5"><figcaption className="mb-4 text-xs font-black uppercase tracking-widest text-white/40">{title}</figcaption>{error ? <pre className="whitespace-pre-wrap text-xs text-red-300">{error}</pre> : svg ? <div className="min-w-[620px]" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="h-52 animate-pulse rounded-xl bg-white/5" />}</figure>;
}
