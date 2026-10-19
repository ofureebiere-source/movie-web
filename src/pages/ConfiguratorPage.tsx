import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Sparkles, Wand2 } from 'lucide-react';
import { useAnimeDetail } from '@/hooks/useApiQueries';
import { pageTitle } from '@/lib/brand';

/**
 * The anime embed configurator.
 *
 * Ported 1:1 from frameXTV.xyz's `AnimeEmbedPage` in its configurator mode: an
 * AniList id, an episode number, a sub/dub toggle and an autoplay toggle, with
 * a live preview and a copyable iframe snippet.
 */
export default function ConfiguratorPage() {
  const [anilistId, setAnilistId] = useState('21');
  const [episode, setEpisode] = useState(1);
  const [subType, setSubType] = useState<'sub' | 'dub'>('sub');
  const [autoplay, setAutoplay] = useState(true);
  const [copied, setCopied] = useState(false);

  const { data: detail } = useAnimeDetail(anilistId, anilistId.trim().length > 0);

  useEffect(() => {
    document.title = pageTitle('Embed Configurator');
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';

  const embedUrl = useMemo(() => {
    const search = new URLSearchParams({
      id: anilistId.trim() || '21',
      type: 'anime',
      season: '1',
      episode: String(episode),
      sub_type: subType,
    });
    if (autoplay) search.set('autoplay', '1');
    search.set('origin', 'internal');
    return `${origin}/embed/anime?${search.toString()}`;
  }, [anilistId, episode, subType, autoplay, origin]);

  const snippet = `<iframe\n  src="${embedUrl}"\n  width="100%" height="100%"\n  frameborder="0"\n  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"\n  allowfullscreen\n></iframe>`;

  const maxEpisodes = detail?.episodes ?? 0;

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="space-y-2 border-b border-white/[0.04] pb-5">
        <div className="flex items-center space-x-2">
          <Wand2 className="w-4 h-4 text-white" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Embed Configurator</h1>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400">
          Build an anime embed URL, preview it, then copy the iframe straight into your site.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-950/60 border border-white/[0.05] rounded-xl p-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="anilist-id" className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              AniList ID
            </label>
            <input
              id="anilist-id"
              type="text"
              inputMode="numeric"
              value={anilistId}
              onChange={(event) => setAnilistId(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 21"
              className="w-full bg-black text-white text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all font-mono"
            />
            {detail?.title && (
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-rose-500" />
                <span className="text-zinc-200 font-medium">{detail.title}</span>
                {detail.year && <span className="font-mono">({detail.year})</span>}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="episode" className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Episode
            </label>
            <div className="flex items-center gap-2">
              <input
                id="episode"
                type="number"
                min={1}
                max={maxEpisodes || undefined}
                value={episode}
                onChange={(event) => setEpisode(Math.max(1, Number(event.target.value) || 1))}
                className="w-28 bg-black text-white text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all font-mono"
              />
              {maxEpisodes > 0 && (
                <span className="text-[11px] font-mono text-zinc-500">of {maxEpisodes}</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Audio</span>
            <div className="flex items-center gap-1.5">
              {(['sub', 'dub'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSubType(option)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-colors cursor-pointer uppercase ${
                    subType === option
                      ? 'bg-white text-black font-bold'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer">
            <span>Autoplay</span>
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(event) => setAutoplay(event.target.checked)}
              className="accent-rose-500 cursor-pointer"
            />
          </label>

          <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Embed URL</span>
            <code className="block text-[11px] font-mono text-emerald-400 break-all">{embedUrl}</code>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">iframe snippet</span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(snippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                  copied ? 'bg-emerald-500 text-black' : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {copied ? <Check className="w-3 h-3 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-black border border-zinc-800 overflow-x-auto text-[11px] font-mono text-zinc-300 leading-relaxed">
              <code>{snippet}</code>
            </pre>
          </div>
        </div>

        <div className="bg-zinc-950/60 border border-white/[0.05] rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-bold text-zinc-200">Live preview</h2>
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-black border border-zinc-800">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title="Anime embed preview"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            The preview loads the same URL your visitors will. Autoplay may be blocked until the iframe has been
            interacted with, which is browser policy rather than a player setting.
          </p>
        </div>
      </div>
    </div>
  );
}
