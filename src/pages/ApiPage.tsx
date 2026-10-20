import { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronRight, Code2, Copy, Server, SlidersVertical } from 'lucide-react';
import { SITE_NAME } from '@/lib/brand';

/**
 * The API / documentation page.
 *
 * Ported 1:1 from frameXTV.xyz's `DocsPage`: a sticky sidebar of four sections
 * with a scroll spy, then Getting Started (iframe + React snippets), the
 * query-parameter table, the postMessage SDK, and the provider pipeline.
 *
 * The one deliberate difference is the embed origin. The reference hardcodes
 * its own apex domain unless it is running on a real deployment, which would
 * make every snippet on a self-hosted copy point at somebody else's site. Here
 * the origin is always `window.location.origin`, so the copied snippet targets
 * the instance that produced it.
 */

type SectionId = 'getting-started' | 'query-params' | 'post-message-api' | 'providers';

const NAV: { id: SectionId; label: string; icon: typeof BookOpen }[] = [
  { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
  { id: 'query-params', label: 'Query Parameters', icon: SlidersVertical },
  { id: 'post-message-api', label: 'PostMessage API', icon: Code2 },
  { id: 'providers', label: 'Providers & Pipeline', icon: Server },
];

const PARAMS: { name: string; values: string; fallback: string; description: string }[] = [
  { name: 'autoplay', values: '1 | 0', fallback: '1', description: 'Automatically start video playback on iframe load.' },
  { name: 'muted', values: '1 | 0', fallback: '0', description: 'Start playback muted (required by browsers for unmuted autoplay).' },
  { name: 't / start', values: 'seconds (e.g. 120)', fallback: '0', description: 'Seek directly to specified timestamp in seconds on playback start.' },
  { name: 'speed', values: '0.5 | 1 | 1.25 | 1.5 | 2', fallback: '1', description: 'Set initial video playback speed rate.' },
  { name: 'controls', values: '1 | 0', fallback: '1', description: 'Show or hide custom bottom video player control bar.' },
  { name: 'server / provider', values: 'barbarian | archer | goblin ...', fallback: 'auto', description: 'Pre-select active extraction server provider.' },
  { name: 'title', values: 'string', fallback: 'null', description: 'Override title overlay banner text shown inside player header.' },
  { name: 'poster / backdrop', values: 'image_url', fallback: 'null', description: 'Custom background poster image URL before video playback starts.' },
];

const PROVIDERS: { name: string; description: string }[] = [
  { name: 'Barbarian I', description: 'Built-in multi-language subtitles & ultra-fast HLS stream decryption.' },
  { name: 'Archer II', description: 'Multi-audio tracks & 4K Ultra HD playback support.' },
  { name: 'Goblin III', description: 'Fast automatic stream extraction mirror for popular titles.' },
  { name: 'P.E.K.K.A IV', description: 'High bitrate 1080p uncompressed stream server.' },
];

export default function ApiPage() {
  const [section, setSection] = useState<SectionId>('getting-started');
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';

  useEffect(() => {
    document.title = `API & Embed Documentation — ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY + 120;
      for (let i = NAV.length - 1; i >= 0; i -= 1) {
        const node = document.getElementById(NAV[i].id);
        if (node && node.offsetTop <= y) {
          setSection(NAV[i].id);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const copy = (value: string, key: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const goTo = (id: SectionId) => {
    setSection(id);
    const node = document.getElementById(id);
    if (!node) return;
    window.scrollTo({ top: node.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
  };

  const iframeSnippet = `<iframe
  src="${origin}/embed/550?autoplay=1&muted=0"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
></iframe>`;

  const reactSnippet = `import React from 'react';

export function VideoPlayer({ tmdbId, season, episode }) {
  const embedUrl = season && episode
    ? "${origin}/embed/\${tmdbId}/\${season}/\${episode}"
    : "${origin}/embed/\${tmdbId}";

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800">
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        allowFullScreen
        title="${SITE_NAME} Stream Player"
      />
    </div>
  );
}`;

  const postMessageSnippet = `// Select target iframe element
const iframe = document.querySelector('iframe');

// Send Play / Pause Commands
iframe.contentWindow.postMessage({ action: 'play' }, '*');
iframe.contentWindow.postMessage({ action: 'pause' }, '*');

// Seek to specific timestamp (seconds) or relative offset (+10s / -10s)
iframe.contentWindow.postMessage({ action: 'seek', time: 120 }, '*');
iframe.contentWindow.postMessage({ action: 'seekBy', seconds: 10 }, '*');

// Volume & Mute Control (0.0 to 1.0)
iframe.contentWindow.postMessage({ action: 'setVolume', volume: 0.8 }, '*');
iframe.contentWindow.postMessage({ action: 'mute' }, '*');

// Switch Active Extraction Provider & Subtitle Index
iframe.contentWindow.postMessage({ action: 'setProvider', provider: 'archer' }, '*');
iframe.contentWindow.postMessage({ action: 'setSubtitle', index: 0 }, '*');

// Listen to Real-Time Telemetry Events from Player
window.addEventListener('message', (event) => {
  if (event.data?.event === 'frameXTV:timeupdate') {
    console.log('Progress:', event.data.currentTime, '/', event.data.duration);
  }
});`;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 sticky top-20 shadow-md">
            <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3 mb-3">
              <BookOpen className="w-4 h-4 text-white" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">Documentation</h2>
            </div>
            <nav className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1 pb-1 lg:pb-0 no-scrollbar scroll-touch">
              {NAV.map((entry) => {
                const active = section === entry.id;
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => goTo(entry.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap lg:whitespace-normal w-full shrink-0 lg:shrink min-h-[36px] cursor-pointer active:scale-95 ${
                      active ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-black' : 'text-zinc-400'}`} />
                      <span>{entry.label}</span>
                    </div>
                    <ChevronRight className={`hidden lg:block w-3.5 h-3.5 opacity-60 ${active ? 'text-black' : 'text-transparent'}`} />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-12">
          <section id="getting-started" className="space-y-6 scroll-mt-24">
            <div className="border-b border-zinc-800 pb-4">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-semibold">Overview</span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                Getting Started with {SITE_NAME}
              </h1>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-3xl">
                {SITE_NAME} provides ultra-fast, clean, and responsive HTML5 iframe stream embeds for movies and TV
                shows. Easily integrate high-bitrate video streams into any web app, CMS, or streaming portal using
                standard IFrames or JavaScript controls.
              </p>
            </div>

            <SnippetCard
              title="Basic IFrame Integration"
              code={iframeSnippet}
              copied={copied === 'basic-iframe'}
              onCopy={() => copy(iframeSnippet, 'basic-iframe')}
              wrap
            />
            <SnippetCard
              title="React / Next.js Component Example"
              code={reactSnippet}
              copied={copied === 'react-snippet'}
              onCopy={() => copy(reactSnippet, 'react-snippet')}
            />
          </section>

          <section id="query-params" className="space-y-6 scroll-mt-24">
            <div className="border-b border-zinc-800 pb-4">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-semibold">Configuration</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">URL Query Parameters Reference</h2>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-3xl">
                Customize playback behavior, pre-select server extractors, set initial timestamps, or hide UI controls
                directly by appending URL query parameters to any embed link.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto scroll-touch">
                <table className="w-full min-w-[500px] text-left text-xs font-mono border-collapse">
                  <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Parameter</th>
                      <th className="p-3.5">Accepted Values</th>
                      <th className="p-3.5">Default</th>
                      <th className="p-3.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80 text-zinc-300 text-[11px]">
                    {PARAMS.map((param) => (
                      <tr key={param.name} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-3.5 font-bold text-white">{param.name}</td>
                        <td className="p-3.5 text-zinc-400">{param.values}</td>
                        <td className="p-3.5 text-zinc-500">{param.fallback}</td>
                        <td className="p-3.5 font-sans text-zinc-300">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="post-message-api" className="space-y-6 scroll-mt-24">
            <div className="border-b border-zinc-800 pb-4">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-semibold">SDK Reference</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                JavaScript postMessage API Controller
              </h2>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-3xl">
                Control the embedded {SITE_NAME} player dynamically from your host webpage using standard cross-window
                postMessage events. Send playback actions (play, pause, seek, volume, provider) or listen to real-time
                playback telemetry events.
              </p>
            </div>

            <SnippetCard
              title="postMessage JavaScript SDK Example"
              code={postMessageSnippet}
              copied={copied === 'postmessage-code'}
              onCopy={() => copy(postMessageSnippet, 'postmessage-code')}
            />
          </section>

          <section id="providers" className="space-y-6 scroll-mt-24">
            <div className="border-b border-zinc-800 pb-4">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-semibold">Infrastructure</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                Extraction Providers &amp; Fallback Pipeline
              </h2>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-3xl">
                {SITE_NAME} aggregates multi-tier stream extraction servers (Barbarian, Archer, Goblin, P.E.K.K.A,
                etc.). If an extraction source experiences downtime or buffering issues, the engine automatically falls
                back to alternative active providers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PROVIDERS.map((provider) => (
                <div key={provider.name} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-mono font-bold uppercase text-white flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>{provider.name}</span>
                  </h4>
                  <p className="text-xs text-zinc-400 font-sans">{provider.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SnippetCard({
  title,
  code,
  copied,
  onCopy,
  wrap = false,
}: {
  title: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
  wrap?: boolean;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">{title}</h3>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white transition-all cursor-pointer min-h-[32px] px-2.5 py-1 rounded-md hover:bg-zinc-900 active:scale-95"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre
        className={`p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed ${
          wrap ? 'whitespace-pre-wrap break-all select-all' : 'whitespace-pre-wrap'
        }`}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
