import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Player from '@/components/Player';
import { getStream, type MediaType } from '@/lib/api';
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
 * `?autoplay=1&origin=internal&t=SECONDS` are honoured.
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
  const startTime = Math.max(0, parseInt(params.get('t') || '0', 10) || 0);
  const autoPlay = params.get('autoplay') !== '0';

  useEffect(() => {
    document.title = `${SITE_NAME} Embed`;
    document.body.style.background = '#000';
  }, []);

  const stream = useQuery({
    queryKey: ['embed-stream', mediaType, mediaKey, seasonNumber, episodeNumber],
    queryFn: () =>
      getStream(mediaKey, mediaType, {
        season: mediaType === 'movie' ? undefined : seasonNumber,
        episode: mediaType === 'movie' ? undefined : episodeNumber,
      }),
    enabled: Boolean(mediaKey),
    staleTime: 600_000,
    retry: 2,
  });

  const sources = stream.data?.sources ?? [];
  const activeSource = sources[0];

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
        title={
          mediaType === 'tv'
            ? `S${seasonNumber} · E${episodeNumber}`
            : mediaType === 'anime'
              ? `Episode ${episodeNumber}`
              : undefined
        }
        subtitles={stream.data?.subtitles ?? []}
        startTime={startTime}
        autoPlay={autoPlay}
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
