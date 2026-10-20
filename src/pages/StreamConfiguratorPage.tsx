import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Code2, ExternalLink, Film, MonitorPlay, Tv } from 'lucide-react';
import DiscordBanner from '@/components/DiscordBanner';
import { getDetail } from '@/lib/api';
import { pageTitle } from '@/lib/brand';

/**
 * The film/series stream configurator.
 *
 * Ported 1:1 from frameXTV.xyz's `Dashboard` chunk: quick TMDB presets, a
 * movie/TV switch, the TMDB id with season and episode, a collapsible
 * "Advanced: Embed Code & Direct Link" panel, and a live preview iframe that
 * resolves the id to a title through the detail endpoint. The dismissible
 * Discord banner sits above the panel, as upstream.
 *
 * The id field is debounced by 400 ms so the preview iframe is not reloaded on
 * every keystroke.
 */

const PRESETS = [
  {
    title: 'Fight Club',
    id: '550',
    type: 'movie' as const,
    poster: 'https://image.tmdb.org/t/p/w1280/hZkgoQY85XMvE78mOS2v7WDEOfW.jpg',
  },
  {
    title: 'Game of Thrones',
    id: '1399',
    type: 'tv' as const,
    season: 1,
    episode: 1,
    poster: 'https://image.tmdb.org/t/p/w1280/2OMG0YKMfwZ1j3A8d2hNJigvZsu.jpg',
  },
  {
    title: 'Cyberpunk: Edgerunners',
    id: '105248',
    type: 'tv' as const,
    season: 1,
    episode: 1,
    poster: 'https://image.tmdb.org/t/p/w1280/5d6B1gY0u41W9L1k0R1Xq8962qD.jpg',
  },
  {
    title: 'Interstellar',
    id: '157336',
    type: 'movie' as const,
    poster: 'https://image.tmdb.org/t/p/w1280/rAiYTfKGqDCRIIqo6LEuPJjfZZ2.jpg',
  },
];

export default function StreamConfiguratorPage() {
  const [discordVisible, setDiscordVisible] = useState(() => {
    try {
      return localStorage.getItem('discordBannerDismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const [idInput, setIdInput] = useState('550');
  const [id, setId] = useState('550');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [copied, setCopied] = useState(false);
  const [resolved, setResolved] = useState<{ title: string; category?: string } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle('Stream Configurator');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setId(idInput), 400);
    return () => clearTimeout(timer);
  }, [idInput]);

  useEffect(() => {
    let cancelled = false;
    const clean = id.trim();
    if (!clean) {
      setResolved(null);
      return;
    }
    getDetail(clean, mediaType)
      .then((detail) => {
        if (cancelled) return;
        setResolved(detail ? { title: detail.title, category: detail.type } : null);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, mediaType]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setIdInput(preset.id);
    setId(preset.id);
    setMediaType(preset.type);
    if (preset.season) setSeason(preset.season);
    if (preset.episode) setEpisode(preset.episode);
  };

  const resolvedId = id.trim() || idInput.trim() || '550';
  const path =
    mediaType === 'movie' ? `/embed/${resolvedId}` : `/embed/${resolvedId}/${season}/${episode}`;
  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  const embedUrl = `${origin}${path}`;
  const snippet = `<iframe src="${origin}${path}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;

  return (
    <div className="min-h-full page-bg text-zinc-100 flex flex-col font-sans w-full overflow-x-hidden">
      {discordVisible && (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4">
          <DiscordBanner
            onClose={() => {
              setDiscordVisible(false);
              try {
                localStorage.setItem('discordBannerDismissed', 'true');
              } catch {
                /* disabled */
              }
            }}
          />
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="order-1 lg:col-span-5 space-y-4 w-full">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <MonitorPlay className="w-4 h-4 text-white" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Stream Configurator
                </h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">TMDB RESOLVER</span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active = idInput === preset.id && mediaType === preset.type;
                  return (
                    <button
                      key={`${preset.id}${preset.type}`}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-all font-sans font-medium min-h-[32px] cursor-pointer active:scale-95 inline-flex items-center ${
                        active
                          ? 'bg-white text-black font-bold shadow-md'
                          : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                    >
                      {preset.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Media Type
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setMediaType('movie')}
                  className={`flex items-center justify-center space-x-2 py-1.5 rounded-md font-medium transition-all min-h-[34px] cursor-pointer active:scale-95 ${
                    mediaType === 'movie' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Movie</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('tv')}
                  className={`flex items-center justify-center space-x-2 py-1.5 rounded-md font-medium transition-all min-h-[34px] cursor-pointer active:scale-95 ${
                    mediaType === 'tv' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>TV Show</span>
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono text-zinc-300 font-medium">TMDB ID</label>
                  <span className="text-[10px] text-zinc-400 font-mono">e.g. 550 (Fight Club)</span>
                </div>
                <input
                  type="text"
                  value={idInput}
                  onChange={(event) => setIdInput(event.target.value)}
                  placeholder="e.g. 550"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white transition-colors min-h-[40px]"
                />
              </div>

              {mediaType === 'tv' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 mb-1">Season</label>
                    <input
                      type="number"
                      min={1}
                      value={season}
                      onChange={(event) => setSeason(parseInt(event.target.value, 10) || 1)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white transition-colors min-h-[40px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 mb-1">Episode</label>
                    <input
                      type="number"
                      min={1}
                      value={episode}
                      onChange={(event) => setEpisode(parseInt(event.target.value, 10) || 1)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white transition-colors min-h-[40px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-lg transition-all">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="w-full p-4 flex items-center justify-between text-left text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-zinc-400" />
                <span>Advanced: Embed Code &amp; Direct Link</span>
              </div>
              {advancedOpen ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {advancedOpen && (
              <div className="p-4 border-t border-zinc-800 space-y-3 bg-zinc-950">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">HTML IFrame Snippet</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(snippet);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center space-x-1 text-xs text-zinc-300 hover:text-white transition-all min-h-[30px] px-2 py-1 rounded hover:bg-zinc-900 active:scale-95 cursor-pointer"
                  >
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {snippet}
                </pre>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
                  <span>Path: {path}</span>
                  <a
                    href={embedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-white hover:underline font-medium"
                  >
                    <span>Launch Isolated Embed</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="order-2 lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MonitorPlay className="w-4 h-4 text-white" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Live Player Preview {resolved?.title ? `— ${resolved.title}` : ''}
              </h3>
            </div>
          </div>

          <div className="w-full aspect-video bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative">
            <iframe
              src={embedUrl}
              title="frameXTV Live Embed Preview"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
