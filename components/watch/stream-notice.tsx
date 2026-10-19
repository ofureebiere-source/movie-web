'use client';

import { useTranslations } from 'next-intl';
import { IoRefresh, IoWarningOutline } from 'react-icons/io5';
import type { StreamReason } from 'hooks/useStreamReachability';

/**
 * What the viewer sees when a title's stream cannot load.
 *
 * Deliberately one variant and one message. There used to be a second "you are
 * watching the backup source" bar, and a "switch to the backup" button on this
 * one — both described our plumbing rather than the film, and the viewer has no
 * reason to care which of our addresses the video came from. Playback now
 * falls through to the next working source on its own; the only thing worth
 * interrupting somebody for is "it didn't load", plus a way to try again.
 *
 * The reason enum still reaches here because the advice differs: WARP and VPN
 * are things the viewer can switch off, and saying so is the whole value of
 * the message.
 */
export default function StreamNotice({
  reason,
  isRetrying,
  onRetry,
}: {
  reason: StreamReason | null;
  isRetrying?: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations('watch.stream');
  const key = reason ?? 'unknown';

  return (
    <div className="on-artwork relative w-full aspect-video bg-black">
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <IoWarningOutline size={36} className="mx-auto text-brand" />
          <h2 className="mt-3 text-lg font-semibold text-content-main lg:text-xl">{t(`${key}.title`)}</h2>
          <p className="mt-2 text-sm text-content-soft lg:text-base">{t(`${key}.body`)}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={onRetry} disabled={isRetrying} className="glass-btn">
              <IoRefresh size={18} className={isRetrying ? 'animate-spin' : ''} />
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
