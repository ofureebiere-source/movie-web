import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Code2, Copy, ExternalLink, Lock, Zap } from 'lucide-react';
import { SITE_NAME, TAGLINE } from '@/lib/brand';
import { apiBase, BACKENDS } from '@/lib/config';
import { pageTitle } from '@/lib/brand';

/**
 * The API / docs page.
 *
 * Ported 1:1 from frameXTV.xyz's `DocsPage` + `Dashboard`: the endpoint table,
 * the copyable embed snippets, the feature list, and a live "active backend"
 * readout so a viewer can confirm which origin the failover settled on.
 */

const ENDPOINTS: { method: string; path: string; description: string }[] = [
  { method: 'GET', path: '/api/home', description: 'Curated hero plus the ten home rails in one payload' },
  { method: 'GET', path: '/api/discover?type=movie|tv', description: 'Paged catalogue with category, genre, year, sort and min_rating' },
  { method: 'GET', path: '/anime/api/discover', description: 'Paged anime catalogue (genre names, season, seasonYear, status)' },
  { method: 'GET', path: '/api/search?q=&type=', description: 'Keyword search across films and series' },
  { method: 'GET', path: '/api/details?id=&type=', description: 'One title with cast, videos, recommendations and seasons' },
  { method: 'GET', path: '/api/season?id=&season=', description: "One season's episode list" },
  { method: 'GET', path: '/api/stream?type=&id=&season=&episode=', description: 'Playable sources plus subtitle tracks' },
  { method: 'GET', path: '/anime/api/stream', description: 'Playable anime sources' },
  { method: 'GET', path: '/api/providers', description: 'The aggregator server directory' },
  { method: 'GET', path: '/api/meta?id=&type=', description: 'Title, year and poster for a card' },
  { method: 'GET', path: '/api/subtitles?id=&type=', description: 'Subtitle tracks for a title' },
];

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
        copied ? 'bg-emerald-500 text-black' : 'bg-white text-black hover:bg-zinc-200'
      }`}
    >
      {copied ? <Check className="w-3 h-3 stroke-[3]" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? 'Copied!' : label}</span>
    </button>
  );
}

export default function ApiPage() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const [backend, setBackend] = useState(() => apiBase());

  useEffect(() => {
    document.title = pageTitle('API & Embeds');
  }, []);

  useEffect(() => {
    const onSwitch = () => setBackend(apiBase());
    window.addEventListener('framextv:backend_switch', onSwitch);
    return () => window.removeEventListener('framextv:backend_switch', onSwitch);
  }, []);

  const movieEmbed = `<iframe\n  src="${origin}/embed/27205"\n  width="100%" height="100%"\n  frameborder="0"\n  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"\n  allowfullscreen\n></iframe>`;

  const tvEmbed = `<iframe\n  src="${origin}/embed/tv/1396/1/1?autoplay=1"\n  width="100%" height="100%"\n  frameborder="0"\n  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"\n  allowfullscreen\n></iframe>`;

  const animeEmbed = `<iframe\n  src="${origin}/embed/anime?id=21&episode=1&autoplay=1"\n  width="100%" height="100%"\n  frameborder="0"\n  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"\n  allowfullscreen\n></iframe>`;

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="space-y-2 border-b border-white/[0.04] pb-5">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-white" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">API &amp; Embeds</h1>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl leading-relaxed">
          {SITE_NAME} exposes a keyless catalogue API and a drop-in iframe player. {TAGLINE}. All endpoints are
          CORS-enabled and answer JSON.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: Zap, title: 'No keys, no quotas', body: 'Every endpoint is public. No token, no account, no rate-limit header to chase.' },
          { icon: Lock, title: 'Multi-origin failover', body: 'Three interchangeable origins rotate automatically on a 5xx or a dropped connection.' },
          { icon: ExternalLink, title: 'Drop-in player', body: 'One iframe with autoplay, resume and subtitle support, sized to your container.' },
        ].map((feature) => (
          <div key={feature.title} className="bg-zinc-950/60 border border-white/[0.05] rounded-xl p-4 space-y-2">
            <feature.icon className="w-4 h-4 text-rose-500" />
            <h2 className="text-xs font-bold text-white">{feature.title}</h2>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{feature.body}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white tracking-tight">Active backend</h2>
        <div className="bg-zinc-950/60 border border-white/[0.05] rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-[11px] font-mono text-emerald-400">{backend}</code>
            <CopyButton value={backend} label="Copy base URL" />
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">Known origins: {BACKENDS.join(' · ')}</p>
          <p className="text-[11px] text-zinc-500">
            Pin one with <code className="font-mono text-zinc-300">?backend=xyz</code> in any URL.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white tracking-tight">Endpoints</h2>
        <div className="overflow-hidden rounded-xl border border-white/[0.05]">
          <table className="w-full text-left">
            <thead className="bg-zinc-950/80">
              <tr>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Method</th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Path</th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((endpoint) => (
                <tr key={endpoint.path} className="border-t border-white/[0.04] hover:bg-zinc-950/60 transition-colors">
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] font-mono text-zinc-200 whitespace-nowrap">{endpoint.path}</td>
                  <td className="px-3 py-2 text-[11px] text-zinc-400">{endpoint.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white tracking-tight">Embed snippets</h2>
        <div className="space-y-3">
          {[
            { title: 'Movie', snippet: movieEmbed, demo: '/embed/27205' },
            { title: 'TV episode', snippet: tvEmbed, demo: '/embed/tv/1396/1/1?autoplay=1' },
            { title: 'Anime episode', snippet: animeEmbed, demo: '/embed/anime?id=21&episode=1&autoplay=1' },
          ].map((entry) => (
            <div key={entry.title} className="bg-zinc-950/60 border border-white/[0.05] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] bg-zinc-900/40">
                <h3 className="text-xs font-bold text-zinc-200">{entry.title}</h3>
                <div className="flex items-center gap-2">
                  <Link
                    to={entry.demo}
                    className="text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
                  >
                    open demo
                  </Link>
                  <CopyButton value={entry.snippet} label="Copy iframe" />
                </div>
              </div>
              <pre className="p-3 overflow-x-auto text-[11px] font-mono text-zinc-300 leading-relaxed">
                <code>{entry.snippet}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
