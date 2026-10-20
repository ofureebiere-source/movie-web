import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Code2, ExternalLink, Film, MonitorPlay, Sparkles, Tv, Wand2 } from 'lucide-react';
import { SITE_NAME, pageTitle } from '@/lib/brand';

/**
 * The anime stream configurator.
 *
 * Ported 1:1 from frameXTV.xyz's `AnimeEmbedPage` in its configurator mode:
 * quick AniList presets, a movie/series switch, a sub/dub switch, the AniList
 * id with season and episode, a collapsible "Advanced: Embed Code & Direct
 * Link" panel with the iframe snippet and a launch link, and a live preview
 * iframe beside it. The page is a two-column grid on large screens.
 *
 * The id field is debounced by 400 ms upstream so the preview iframe is not
 * reloaded on every keystroke; that is kept here.
 */

const PRESETS = [
  { title: 'One Piece', id: '21', type: 'tv' as const, season: 1, episode: 1 },
  { title: 'Naruto', id: '20', type: 'tv' as const, season: 1, episode: 1 },
  { title: 'Attack on Titan', id: '16498', type: 'tv' as const, season: 1, episode: 1 },
  { title: 'Jujutsu Kaisen', id: '113415', type: 'tv' as const, season: 1, episode: 1 },
  { title: 'Your Name', id: '21519', type: 'movie' as const },
  { title: 'Spirited Away', id: '199', type: 'movie' as const },
];

export default function AnimeEmbedConfigurator() {
  const [idInput, setIdInput] = useState('21');
  const [id, setId] = useState('21');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('tv');
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [subType, setSubType] = useState<'sub' | 'dub'>('sub');
  const [copied, setCopied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle('Anime Stream Configurator');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setId(idInput), 400);
    return () => clearTimeout(timer);
  }, [idInput]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setIdInput(preset.id);
    setId(preset.id);
    setMediaType(preset.type);
    if (preset.season) setSeason(preset.season);
    if (preset.episode) setEpisode(preset.episode);
  };

  const resolvedId = id.trim() || idInput.trim() || '21';
  const path = `/embed/anime?id=${resolvedId}&type=${mediaType}${
    mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''
  }&sub_type=${subType}`;
  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  const embedUrl = `${origin}${path}`;
  const snippet = `<iframe src="${origin}${path}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="order-1 lg:col-span-5 space-y-4 w-full">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Wand2 className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Anime Stream Configurator
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                ANILIST RESOLVER
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Quick Anime Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active = idInput === preset.id && mediaType === preset.type;
                  return (
                    <button
                      key={`${preset.id}${preset.type}`}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-all font-sans font-medium cursor-pointer ${
                        active
                          ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
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
                  className={`flex items-center justify-center space-x-2 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    mediaType === 'movie' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Anime Movie</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('tv')}
                  className={`flex items-center justify-center space-x-2 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    mediaType === 'tv' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Anime Series</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Audio Preference
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setSubType('sub')}
                  className={`flex items-center justify-center space-x-2 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    subType === 'sub' ? 'bg-rose-500 text-white font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>Subtitled (SUB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubType('dub')}
                  className={`flex items-center justify-center space-x-2 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    subType === 'dub' ? 'bg-rose-500 text-white font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>Dubbed (DUB)</span>
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono text-zinc-300 font-medium">ANILIST ID</label>
                  <span className="text-[10px] text-zinc-400 font-mono">e.g. 21 (One Piece)</span>
                </div>
                <input
                  type="text"
                  value={idInput}
                  onChange={(event) => setIdInput(event.target.value)}
                  placeholder="e.g. 21"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-rose-500 transition-colors"
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
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 mb-1">Episode</label>
                    <input
                      type="number"
                      min={1}
                      value={episode}
                      onChange={(event) => setEpisode(parseInt(event.target.value, 10) || 1)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-rose-500 transition-colors"
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
                    className="flex items-center space-x-1 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
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
                    className="flex items-center space-x-1 text-rose-400 hover:text-rose-300 hover:underline font-medium"
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
              <Sparkles className="w-4 h-4 text-rose-500" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Live Anime Preview</h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              AniList ID: <span className="text-white font-semibold">{resolvedId}</span>{' '}
              {mediaType === 'tv' && `(S${season}E${episode})`}
            </span>
          </div>

          <div className="w-full aspect-video bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative">
            <iframe
              src={embedUrl}
              title={`${SITE_NAME} Anime Live Embed Preview`}
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              className="w-full h-full border-0"
            />
            <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                <MonitorPlay className="w-3 h-3" />
                Live Player Preview
              </span>
            </div>
          </div>
        </div>
    </div>
  );
}
