/**
 * Minimal typings for the two globals the Google Cast sender framework drops on
 * the page:
 *
 *   window.cast.framework.*     the CAF sender (context, remote player, states)
 *   window.chrome.cast.media.*  the media message classes (MediaInfo, Track, …)
 *
 * The reference drives these through `any`; typing the handful of members we
 * touch keeps the hook readable without pulling in the whole
 * @types/chromecast-caf-sender package for a feature that is inert when the
 * sender script is absent.
 */

interface CastMediaInfo {
  contentId: string;
  contentType: string;
  streamType?: string;
  hlsSegmentFormat?: string;
  hlsVideoSegmentFormat?: string;
  metadata?: unknown;
  tracks?: unknown[];
}

interface CastLoadRequest {
  autoplay?: boolean;
  currentTime?: number;
  activeTrackIds?: number[];
}

interface CastTrack {
  trackCustomData?: unknown;
  trackContentType?: string;
  subtype?: string;
  name?: string;
  language?: string;
  trackContentId?: string;
}

interface CastMediaNamespace {
  DEFAULT_MEDIA_RECEIVER_APP_ID: string;
  MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
  GenericMediaMetadata: new () => { title?: string; subtitle?: string; images?: unknown[] };
  Image: new (url: string) => unknown;
  LoadRequest: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
  StreamType: { BUFFERED: string };
  HlsSegmentFormat: { FMP4: string };
  HlsVideoSegmentFormat: { FMP4: string };
  Track: new (id: number, type: number) => CastTrack;
  TrackType: { TEXT: number };
  TextTrackType: { SUBTITLES: string };
  EditTracksInfoRequest: new (activeTrackIds: number[]) => unknown;
}

interface CastContextInstance {
  setOptions: (options: { receiverApplicationId: string; autoJoinPolicy: string }) => void;
  getCurrentSession: () => CastSession | null;
  getCastState: () => string;
  requestSession: () => Promise<void>;
  endCurrentSession: (stopCasting: boolean) => Promise<void>;
  addEventListener: (
    type: string,
    handler: (event: { castState?: string; sessionState?: string }) => void
  ) => void;
}

interface CastSession {
  getCastDevice: () => { friendlyName?: string } | null;
  getMediaSession: () => CastMediaSession | null;
  loadMedia: (request: CastLoadRequest) => Promise<void>;
}

interface CastMediaSession {
  editTracksInfo: (request: unknown, onSuccess?: () => void, onError?: (error: unknown) => void) => void;
}

interface CastRemotePlayer {
  isConnected: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volumeLevel: number;
  isMuted: boolean;
}

interface CastRemotePlayerController {
  playOrPause: () => void;
  seek: () => void;
  setVolumeLevel: () => void;
  muteOrUnmute: () => void;
  addEventListener: (type: string, handler: () => void) => void;
}

interface CastFrameworkNamespace {
  CastContext: { getInstance: () => CastContextInstance };
  CastContextEventType: { CAST_STATE_CHANGED: string; SESSION_STATE_CHANGED: string };
  CastState: {
    NO_DEVICES_AVAILABLE: string;
    NOT_CONNECTED: string;
    CONNECTING: string;
    CONNECTED: string;
  };
  SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string; SESSION_ENDED: string };
  RemotePlayer: new () => CastRemotePlayer;
  RemotePlayerController: new (player: CastRemotePlayer) => CastRemotePlayerController;
  RemotePlayerEventType: {
    IS_CONNECTED_CHANGED: string;
    IS_PAUSED_CHANGED: string;
    CURRENT_TIME_CHANGED: string;
    VOLUME_LEVEL_CHANGED: string;
    IS_MUTED_CHANGED: string;
  };
}

interface ChromeCastNamespace {
  media: CastMediaNamespace;
  AutoJoinPolicy: { ORIGIN_SCOPED: string };
}

interface SolanaProvider {
  isPhantom?: boolean;
  isBraveWallet?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface Window {
  cast?: { framework: CastFrameworkNamespace };
  chrome?: { cast?: ChromeCastNamespace };
  WebKitPlaybackTargetAvailabilityEvent?: unknown;
  phantom?: { solana?: SolanaProvider };
  solana?: SolanaProvider;
}

interface HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}
