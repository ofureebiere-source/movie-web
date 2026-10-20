import { useCallback, useEffect, useRef, useState } from 'react';
import type { FxStreamSource, FxSubtitle } from '@/lib/api';

/**
 * Chromecast + AirPlay, ported from the reference's cast hook.
 *
 * Two transports share one surface:
 *
 *  - Chromecast goes through the CAF sender (`window.cast.framework`) plus the
 *    `chrome.cast.media` message classes. A `RemotePlayerController` mirrors
 *    the TV's clock, play state and volume back so the local chrome keeps
 *    working while the picture is on the TV.
 *  - AirPlay is native to Safari/WebKit: we only flip
 *    `webkitShowPlaybackTargetPicker()` and watch the availability/active
 *    events. Chrome and Firefox never expose the API, so the button stays
 *    hidden there.
 *
 * Nothing here is required for playback — if the sender script never loads,
 * `isCastAvailable` stays false and the buttons are not rendered.
 */

export interface CastMedia {
  source: FxStreamSource;
  playableUrl: string;
  mediaTitle?: string;
  mediaCategory?: string;
  posterUrl?: string;
  subtitles?: FxSubtitle[];
  activeSubtitleIdx?: number | null;
  currentTime?: number;
  autoPlay?: boolean;
}

export interface CastCallbacks {
  onRemoteTimeUpdate?: (time: number, duration: number) => void;
  onRemotePlayStateChange?: (playing: boolean) => void;
  onRemoteVolumeChange?: (volume: number, muted: boolean) => void;
  onCastDisconnected?: (time: number) => void;
}

/** URLs the TV needs in absolute form; a relative path would resolve on the TV. */
function absolute(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
}

/**
 * Some providers serve fragmented MP4 inside the HLS container, which the
 * receiver has to be told about explicitly or it plays the audio and shows a
 * black frame. The reference keys this off the URL shape and the server name.
 */
function isFmp4(url: string, source: FxStreamSource): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('.m4s') ||
    lower.includes('fmp4') ||
    lower.includes('init.mp4') ||
    lower.includes('crap') ||
    lower.includes('movy') ||
    lower.includes('wecollege') ||
    lower.includes('moon.zenoak.top') ||
    lower.includes('ultramoss.top') ||
    Boolean(source.server && source.server.toLowerCase().includes('miner'))
  );
}

export function useCast(videoRef: React.RefObject<HTMLVideoElement | null>, callbacks: CastCallbacks) {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState('');
  const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);
  const [isAirPlayActive, setIsAirPlayActive] = useState(false);

  const remotePlayer = useRef<CastRemotePlayer | null>(null);
  const remoteController = useRef<CastRemotePlayerController | null>(null);
  const session = useRef<CastSession | null>(null);
  // Callbacks live in a ref so the event listeners (registered once) always see
  // the latest closures without being torn down and rebuilt.
  const handler = useRef(callbacks);
  handler.current = callbacks;

  // --- Chromecast ----------------------------------------------------------

  useEffect(() => {
    let poll: number | null = null;

    const init = (): boolean => {
      if (!window.cast || !window.cast.framework || !window.chrome || !window.chrome.cast) return false;
      try {
        const context = window.cast.framework.CastContext.getInstance();
        try {
          const appId =
            window.chrome.cast.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845';
          const autoJoin =
            window.chrome.cast.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped';
          context.setOptions({ receiverApplicationId: appId, autoJoinPolicy: autoJoin });
        } catch {
          /* already configured */
        }

        if (!remotePlayer.current) {
          const player = new window.cast.framework.RemotePlayer();
          const controller = new window.cast.framework.RemotePlayerController(player);
          remotePlayer.current = player;
          remoteController.current = controller;

          const { RemotePlayerEventType } = window.cast.framework;
          controller.addEventListener(RemotePlayerEventType.IS_CONNECTED_CHANGED, () => {
            const connected = player.isConnected;
            setIsCasting(connected);
            if (connected) {
              const current = context.getCurrentSession();
              session.current = current;
              setCastDeviceName(current?.getCastDevice()?.friendlyName || 'Chromecast TV');
            } else {
              session.current = null;
              setCastDeviceName('');
              if (player.currentTime !== undefined) handler.current.onCastDisconnected?.(player.currentTime);
            }
          });
          controller.addEventListener(RemotePlayerEventType.IS_PAUSED_CHANGED, () => {
            handler.current.onRemotePlayStateChange?.(!player.isPaused);
          });
          controller.addEventListener(RemotePlayerEventType.CURRENT_TIME_CHANGED, () => {
            if (player.currentTime !== undefined) {
              handler.current.onRemoteTimeUpdate?.(player.currentTime, player.duration || 0);
            }
          });
          controller.addEventListener(RemotePlayerEventType.VOLUME_LEVEL_CHANGED, () => {
            handler.current.onRemoteVolumeChange?.(player.volumeLevel, player.isMuted);
          });
          controller.addEventListener(RemotePlayerEventType.IS_MUTED_CHANGED, () => {
            handler.current.onRemoteVolumeChange?.(player.volumeLevel, player.isMuted);
          });
        }

        const { CastContextEventType, CastState, SessionState } = window.cast.framework;
        const adopt = () => {
          setIsCasting(true);
          const current = context.getCurrentSession();
          session.current = current;
          setCastDeviceName(current?.getCastDevice()?.friendlyName || 'Chromecast TV');
        };

        context.addEventListener(CastContextEventType.CAST_STATE_CHANGED, (event) => {
          const state = event.castState;
          setIsCastAvailable(state !== CastState.NO_DEVICES_AVAILABLE);
          if (state === CastState.CONNECTED) adopt();
          else if (state === CastState.NOT_CONNECTED) {
            setIsCasting(false);
            setCastDeviceName('');
          }
        });
        context.addEventListener(CastContextEventType.SESSION_STATE_CHANGED, (event) => {
          const state = event.sessionState;
          if (state === SessionState.SESSION_STARTED || state === SessionState.SESSION_RESUMED) adopt();
          else if (state === SessionState.SESSION_ENDED) {
            setIsCasting(false);
            setCastDeviceName('');
          }
        });

        const state = context.getCastState();
        setIsCastAvailable(state !== CastState.NO_DEVICES_AVAILABLE);
        if (state === CastState.CONNECTED) adopt();
        return true;
      } catch (error) {
        console.warn('Cast initialization error:', error);
        return false;
      }
    };

    // The sender script loads async, so the context may not exist on mount.
    if (!init()) {
      let attempts = 0;
      poll = window.setInterval(() => {
        attempts += 1;
        if (init() || attempts > 20) {
          if (poll !== null) window.clearInterval(poll);
        }
      }, 500);
    }

    return () => {
      if (poll !== null) window.clearInterval(poll);
    };
  }, []);

  // --- AirPlay -------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onAvailability = (event: { availability?: string }) => {
      setIsAirPlayAvailable(event.availability === 'available');
    };
    const supportsPicker = typeof video.webkitShowPlaybackTargetPicker === 'function';
    if (supportsPicker || window.WebKitPlaybackTargetAvailabilityEvent !== undefined) {
      setIsAirPlayAvailable(true);
      video.addEventListener('webkitplaybacktargetavailabilitychanged', onAvailability as EventListener);
    }
    if (video.webkitCurrentPlaybackTargetIsWireless) setIsAirPlayActive(true);
    const onWireless = (event: Event) => {
      const target = event.target as HTMLVideoElement & { webkitCurrentPlaybackTargetIsWireless?: boolean };
      setIsAirPlayActive(Boolean(target?.webkitCurrentPlaybackTargetIsWireless));
    };
    video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', onWireless);

    return () => {
      video.removeEventListener('webkitplaybacktargetavailabilitychanged', onAvailability as EventListener);
      video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', onWireless);
    };
  }, [videoRef]);

  // --- Loading media onto the receiver -------------------------------------

  const loadMediaOnCast = useCallback(async (media: CastMedia): Promise<boolean> => {
    const castMedia = window.chrome?.cast?.media;
    if (!castMedia) {
      console.warn('Google Cast media framework not available.');
      return false;
    }
    const context = window.cast!.framework.CastContext.getInstance();
    let active = context.getCurrentSession();
    for (let i = 0; i < 10 && !active; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      active = context.getCurrentSession();
    }
    if (!active) {
      console.warn('No active Cast session found.');
      return false;
    }

    try {
      const url = absolute(media.playableUrl);
      const hls = media.source.type === 'hls' || url.includes('.m3u8') || media.playableUrl.includes('.m3u8');
      const contentType = hls ? 'application/x-mpegurl' : 'video/mp4';
      const fmp4 = hls && isFmp4(url, media.source);

      const info = new castMedia.MediaInfo(url, contentType);
      info.streamType = castMedia.StreamType?.BUFFERED || 'BUFFERED';
      if (fmp4) {
        info.hlsSegmentFormat = castMedia.HlsSegmentFormat?.FMP4 || 'fmp4';
        info.hlsVideoSegmentFormat =
          castMedia.HlsVideoSegmentFormat?.FMP4 || castMedia.HlsSegmentFormat?.FMP4 || 'fmp4';
      }

      const metadata = new castMedia.GenericMediaMetadata();
      metadata.title = media.mediaTitle || 'Streaming Video';
      metadata.subtitle = media.mediaCategory || 'frameXTV Stream';
      if (media.posterUrl) metadata.images = [new castMedia.Image(absolute(media.posterUrl))];
      info.metadata = metadata;

      const tracks: unknown[] = [];
      const activeTrackIds: number[] = [];
      (media.subtitles ?? []).forEach((subtitle, index) => {
        if (!subtitle.url) return;
        const id = index + 1;
        const track = new castMedia.Track(id, castMedia.TrackType.TEXT);
        track.trackCustomData = null;
        track.trackContentType = 'text/vtt';
        track.subtype = castMedia.TextTrackType.SUBTITLES;
        track.name = subtitle.label || subtitle.language || `Subtitle ${id}`;
        track.language = subtitle.language || 'en';
        track.trackContentId = absolute(subtitle.url);
        tracks.push(track);
        if (media.activeSubtitleIdx === index) activeTrackIds.push(id);
      });
      if (tracks.length > 0) info.tracks = tracks;

      const request = new castMedia.LoadRequest(info);
      request.autoplay = media.autoPlay ?? true;
      request.currentTime = Math.max(0, media.currentTime ?? 0);
      if (activeTrackIds.length > 0) request.activeTrackIds = activeTrackIds;

      try {
        await active.loadMedia(request);
      } catch (error) {
        // A receiver that rejects the subtitle tracks still plays the video;
        // retry stream-only rather than failing the whole cast.
        if (tracks.length > 0) {
          console.warn('Cast loadMedia failed with subtitle tracks, retrying stream-only...', error);
          info.tracks = [];
          delete request.activeTrackIds;
          await active.loadMedia(request);
        } else {
          throw error;
        }
      }

      if (activeTrackIds.length > 0) {
        try {
          const mediaSession = active.getMediaSession();
          if (mediaSession && typeof mediaSession.editTracksInfo === 'function') {
            mediaSession.editTracksInfo(new castMedia.EditTracksInfoRequest(activeTrackIds));
          }
        } catch (error) {
          console.warn('Silent subtitle track activation error:', error);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to load media onto Cast device:', error);
      return false;
    }
  }, []);

  // --- Public triggers -----------------------------------------------------

  const triggerChromecast = useCallback(
    async (media: CastMedia) => {
      if (!window.cast?.framework) {
        const video = videoRef.current;
        if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
          video.webkitShowPlaybackTargetPicker();
          return;
        }
        alert('Chromecast requires Chrome or Edge on the same WiFi network as your Cast device.');
        return;
      }
      try {
        const context = window.cast.framework.CastContext.getInstance();
        if (!context.getCurrentSession()) {
          await context.requestSession();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        await loadMediaOnCast(media);
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (error !== 'cancel' && code !== 'cancel') console.warn('Cast request failed or cancelled:', error);
      }
    },
    [loadMediaOnCast, videoRef]
  );

  const stopCasting = useCallback(async () => {
    try {
      if (window.cast?.framework) {
        await window.cast.framework.CastContext.getInstance().endCurrentSession(true);
      }
    } catch (error) {
      console.warn('Error ending cast session:', error);
    }
  }, []);

  const triggerAirPlay = useCallback(() => {
    const video = videoRef.current;
    if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
      video.webkitShowPlaybackTargetPicker();
    } else {
      alert('AirPlay target selection is supported natively on Safari, iOS, and macOS.');
    }
  }, [videoRef]);

  const remotePlayOrPause = useCallback(() => {
    remoteController.current?.playOrPause();
  }, []);
  const remoteSeek = useCallback((time: number) => {
    if (remotePlayer.current && remoteController.current) {
      remotePlayer.current.currentTime = time;
      remoteController.current.seek();
    }
  }, []);
  const remoteSetVolume = useCallback((level: number) => {
    if (remotePlayer.current && remoteController.current) {
      remotePlayer.current.volumeLevel = level;
      remoteController.current.setVolumeLevel();
    }
  }, []);
  const remoteSetMuted = useCallback(() => {
    remoteController.current?.muteOrUnmute();
  }, []);

  const setRemoteActiveSubtitle = useCallback((index: number | null) => {
    try {
      const castMedia = window.chrome?.cast?.media;
      if (!castMedia || !window.cast?.framework) return;
      const mediaSession = window.cast.framework.CastContext.getInstance()
        .getCurrentSession()
        ?.getMediaSession();
      if (!mediaSession) return;
      const ids = index === null ? [] : [index + 1];
      mediaSession.editTracksInfo(new castMedia.EditTracksInfoRequest(ids));
    } catch (error) {
      console.warn('Error updating remote subtitles:', error);
    }
  }, []);

  return {
    isCastAvailable,
    isCasting,
    castDeviceName,
    isAirPlayAvailable,
    isAirPlayActive,
    triggerChromecast,
    stopCasting,
    triggerAirPlay,
    loadMediaOnCast,
    setRemoteActiveSubtitle,
    remotePlayOrPause,
    remoteSeek,
    remoteSetVolume,
    remoteSetMuted,
  };
}
