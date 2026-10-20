import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Player from '@/components/Player';
import { getStream, type FxStream, type MediaType } from '@/lib/api';
import { mediaId } from '@/lib/id';
import { saveProgress } from '@/lib/watchProgress';
import { SITE_NAME } from '@/lib/brand';

/**
 * The bare embed player.
 *
 * Ported 1:1 from frameXTV.xyz's `EmbedPage` / `AnimeEmbedPage`: no site chrome,
 * no footer, just the player filling the viewport. It accepts the reference's
 * whole embed URL family:
 *
 *   /embed/:tmdbId                     /embed/movie/:tmdbId
 *   /embed/:tmdbId/:season/:episode    /embed/tv/:tmdbId/:season/:episode
 *   /embed/series/:tmdbId/:s/:e        /embed/anime?id=&episode=
 *
 * and the reference's full query contract: `autoplay`, `muted`, `t`/`start`,
 * `speed`, `controls`, `server`/`provider`, `title` and `poster`/`backdrop`.
 */
export default function EmbedPage() {
  const { tmdbId, season, episode } = useParams();
  const [params] = useSearchParams();

  const explicitType = params.get('type');
  const isAnime = explicitType === 'anime' || window.location.pathname.startsWith('/embed/anime');
  const mediaType: MediaType = isAnime ? 'anime' : season || params.get('season') ? 'tv' : 'movie';

  const mediaKey = mediaId(tmdbId || params.get('id'));
  const seasonNumber = Math.max(1, parseInt(season || params.get('season') || '1', 10) || 1);
  const episodeNumber = Math.max(1, parseInt(episode || params.get('episode') || '1', 10) || 1);
  const startTime = Math.max(0, parseFloat(params.get('t') || params.get('start') || '0') || 0);
  const autoPlay = params.get('autoplay') !== '0';
  const startMuted = params.get('muted') === '1';
  const initialSpeed = parseFloat(params.get('speed') || '1') || 1;
  const hideControls = params.get('controls') === '0';
  const provider = params.get('provider') || params.get('server') || undefined;
  const customTitle = params.get('title') || undefined;
  const customPoster = params.get('poster') || params.get('backdrop') || undefined;
  // Bumped by the host when the viewer asks to try again. It rides in the URL so
  // a retry is a genuinely new request instead of a cache hit on the empty
  // resolution that made the title unplayable in the first place.
  const resolveNonce = params.get('r') || '0';

  useEffect(() => {
    document.title = `${SITE_NAME} Embed`;
    document.body.style.background = '#000';
  }, []);

  const stream = useQuery<FxStream | null>({
    queryKey: ['embed-stream', mediaType, mediaKey, seasonNumber, episodeNumber, provider ?? 'auto', resolveNonce],
    queryFn: async () => {
      const ask = () =>
        getStream(mediaKey, mediaType, {
          season: mediaType === 'movie' ? undefined : seasonNumber,
          episode: mediaType === 'movie' ? undefined : episodeNumber,
          provider,
        });
      let body = await ask();
      // A flaky provider can answer with an empty source list on the first ask
      // and a good one moments later. Re-asking once here re-resolves the title
      // immediately instead of making the viewer wait for the host to hop
      // servers, which is what made re-resolving feel broken.
      for (let attempt = 0; attempt < 2 && !body?.sources?.length; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        body = await ask();
      }
      return body;
    },
    enabled: Boolean(mediaKey),
    // A resolution that yielded no source is worthless to cache: holding it for
    // ten minutes is what made a title hard to re-resolve after a flaky server.
    // Only a resolution that actually produced a source is worth remembering.
    staleTime: (query: { state: { data?: FxStream | null } }) =>
      query.state.data?.sources?.length ? 600_000 : 0,
    gcTime: 900_000,
    retry: 2,
  });

  const sources = stream.data?.sources ?? [];
  const activeSource = sources[0];
  const noSource = Boolean(mediaKey) && !stream.isLoading && !activeSource;

  // A resolution with zero sources is a dead end for this server. Report it to
  // the host straight away rather than waiting out the frame watchdog, so the
  // watch page can hop to another provider without the viewer seeing a stall.
  useEffect(() => {
    if (!noSource) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ event: 'frameXTV:error', message: 'No playable source for this title.' }, '*');
    }
  }, [noSource, resolveNonce]);


  if (!mediaKey) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center text-xs font-mono text-zinc-500">
        Missing media id.
      </div>
    );
  }

  if (stream.isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (!activeSource) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center text-xs font-mono text-zinc-500">
        No playable source for this title.
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      <Player
        src={activeSource.url}
        sourceType={activeSource.type}
        poster={customPoster}
        title={
          customTitle ??
          (mediaType === 'tv'
            ? `S${seasonNumber} · E${episodeNumber}`
            : mediaType === 'anime'
              ? `Episode ${episodeNumber}`
              : undefined)
        }
        subtitles={stream.data?.subtitles ?? []}
        startTime={startTime}
        autoPlay={autoPlay}
        startMuted={startMuted}
        initialSpeed={initialSpeed}
        hideControls={hideControls}
        onProgress={(seconds, duration) =>
          saveProgress({
            mediaType,
            id: mediaKey,
            season: mediaType === 'tv' ? seasonNumber : undefined,
            episode: mediaType === 'movie' ? undefined : episodeNumber,
            timestamp: seconds,
            duration,
          })
        }
      />
    </div>
  );
}
