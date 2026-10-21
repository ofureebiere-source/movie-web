import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Player from '@/components/Player';
import { getStream, type FxStream, type MediaType } from '@/lib/api';
import { mediaId } from '@/lib/id';
import { isNetwebEnabled, proxiedUrl, resolveNetwebSources, type NetwebSource } from '@/lib/netweb';
import { downloadQualities } from '@/lib/downloadOptions';
import { saveProgress } from '@/lib/watchProgress';
import { readWarmedNetwebSources, readWarmedStream } from '@/lib/streamWarm';
import { isBackupProvider } from '@/lib/vidbolt';
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
  const customYear = params.get('year') || undefined;
  const customPoster = params.get('poster') || params.get('backdrop') || undefined;
  // Bumped by the host when the viewer asks to try again. It rides in the URL so
  // a retry is a genuinely new request instead of a cache hit on the empty
  // resolution that made the title unplayable in the first place.
  const resolveNonce = params.get('r') || '0';

  useEffect(() => {
    document.title = `${SITE_NAME} Embed`;
    document.body.style.background = '#000';
  }, []);

  // A `backup` provider is served by the Vidbolt iframe, not the aggregator, so
  // there is nothing to resolve — the Player builds the iframe URL itself.
  const backupMode = isBackupProvider(provider);

  const stream = useQuery<FxStream | null>({
    queryKey: ['embed-stream', mediaType, mediaKey, seasonNumber, episodeNumber, provider ?? 'auto', resolveNonce],
    queryFn: async () => {
      // Prefer a stream the host warmed while the trailer played. It is the same
      // resolve this query would make, just already done, so playback starts
      // without waiting on the aggregator. The host pre-resolves every provider
      // in its bar, so this also covers an explicit `provider`: switching server
      // is a lookup here, not a fresh request. Only used on the first attempt: a
      // server hop or a retry must genuinely re-resolve.
      const warmed = readWarmedStream(
        mediaType,
        mediaKey,
        mediaType === 'movie' ? undefined : seasonNumber,
        mediaType === 'movie' ? undefined : episodeNumber,
        provider
      );
      if (warmed?.sources?.length && resolveNonce === '0') return warmed;

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
    enabled: Boolean(mediaKey) && !backupMode,
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

  // Our own gateway resolves the same title independently of the aggregator.
  // When it answers, the player loads its stream through `/proxy` and the
  // Download button saves through `/v1/download`, so neither the picture nor a
  // save depends on a CDN the browser cannot reach. The aggregator's own
  // sources remain the fallback, so an unreachable gateway degrades to the old
  // behaviour rather than a black screen.
  const netweb = useQuery<NetwebSource[]>({
    queryKey: ['netweb-stream', mediaType, mediaKey, seasonNumber, episodeNumber],
    queryFn: async () => {
      // The detail page resolved the gateway while the viewer was reading the
      // synopsis, so on the usual path this is a lookup rather than a request.
      // A miss falls through to a real resolve, which is the cold path.
      const warmed = readWarmedNetwebSources(
        mediaType,
        mediaKey,
        mediaType === 'movie' ? undefined : seasonNumber,
        mediaType === 'movie' ? undefined : episodeNumber
      );
      if (warmed && resolveNonce === '0') return warmed;
      return resolveNetwebSources(mediaKey, mediaType, {
        season: mediaType === 'movie' ? undefined : seasonNumber,
        episode: mediaType === 'movie' ? undefined : episodeNumber,
        title: customTitle,
        year: customYear,
        // The embed is about to paint a player, so it will not hold the spinner
        // for the warmer's full budget. The usual path never spends this: the
        // detail page has already stashed the resolution, or is still resolving
        // and this call joins that in-flight request instead of starting one.
        timeoutMs: 25_000,
      });
    },
    enabled: Boolean(mediaKey) && !backupMode && isNetwebEnabled(),
    staleTime: 600_000,
    gcTime: 900_000,
    retry: 1,
  });

  const netwebSource = netweb.data?.[0];
  // Every quality the gateway resolved, for the Download row's picker. The
  // player plays `netwebSource` (the first, best one) but the viewer can save
  // any of them.
  const downloadChoices = downloadQualities(netweb.data ?? []);
  // The gateway's stream wins when it answered: it is proxied, so the CDN sees
  // the headers it wants and an HLS playlist is rewritten to route its segments
  // through the gateway too. The aggregator's own source is the fallback and is
  // loaded directly, exactly as before this gateway existed.
  const playerSrc = netwebSource ? proxiedUrl(netwebSource) : activeSource?.url;
  const playerType = netwebSource ? netwebSource.type : activeSource?.type;
  // The gateway's stream is preferred, so when it is in use the player waits for
  // it to settle. Mounting as soon as the aggregator answered would hand the
  // player the fallback URL and quietly undo the preference; the request itself
  // is time-boxed in `resolveNetwebSources`, so an unreachable gateway costs a
  // bounded pause rather than a hang.
  const gatewayPending = isNetwebEnabled() && !backupMode && Boolean(mediaKey) && netweb.isLoading;
  const resolving = !playerSrc && (stream.isLoading || gatewayPending);
  const noSource = Boolean(mediaKey) && !backupMode && !resolving && !playerSrc;

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

  // The gateway is the slower resolver and its stream is the one the player
  // prefers, so wait for it before mounting. Mounting earlier hands `Player` an
  // undefined `src`, which trips its "all servers exhausted" fallback and swaps
  // in the backup iframe for a title the gateway was about to serve.
  if (resolving) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (!playerSrc && !backupMode) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center text-xs font-mono text-zinc-500">
        No playable source for this title.
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      <Player
        src={playerSrc}
        sourceType={playerType}
        downloadSource={
          netwebSource
            ? { url: netwebSource.url, type: netwebSource.type, headers: netwebSource.headers }
            : activeSource
              ? { url: activeSource.url, type: activeSource.type }
              : undefined
        }
        downloadQualities={downloadChoices}
        year={params.get('year') || undefined}
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
        mediaType={mediaType}
        tmdbId={mediaType === 'anime' ? undefined : mediaKey}
        season={seasonNumber}
        episode={episodeNumber}
        anilistId={mediaType === 'anime' ? mediaKey : undefined}
        malId={params.get('mal') || undefined}
        activeProvider={provider}
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
