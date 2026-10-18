'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePlayer } from './player-context';
import { EQ_BANDS, EQ_GAIN_LIMIT, EQ_PRESETS } from 'hooks/useAudioProcessing';
import { EqualizerIcon, MaximizeAudioIcon, CheckIcon } from './icons';

/**
 * Equaliser + volume maximiser, docked directly on the player surface.
 *
 * Deliberately not another level of the settings menu: tuning audio is a
 * see-the-video-while-you-do-it job, so this floats over the picture in a
 * translucent glass panel instead of covering it. The bars stay visible at all
 * times, so a band can be dragged while watching a scene and judged by ear.
 *
 * Everything is glass — low-alpha fills, a blur, and a hairline border — so the
 * picture reads through it. No backdrop is drawn, and pointer events stay
 * inside the panel, so the video behind it keeps playing untouched.
 */
export interface EqualizerPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function EqualizerPanel({ open, onClose }: EqualizerPanelProps) {
  const t = useTranslations('watch.player');
  const { audio } = usePlayer();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  // Close on a click anywhere outside the panel. Registered after the open
  // commit so the button that opened it does not immediately close it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setPresetsOpen(false);
  }, [open]);

  if (!audio.available) {
    return (
      <div
        ref={rootRef}
        aria-hidden={!open}
        className={`pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center px-3 transition-opacity duration-200 lg:bottom-20 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {open && (
          <div className="pointer-events-auto rounded-xl border border-white/15 bg-black/35 px-4 py-3 text-xs text-ink-secondary backdrop-blur-md">
            {t('settings.eqUnavailable')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      aria-hidden={!open}
      // Sits above the bottom bar, centred, and never wider than the player.
      className={`pointer-events-none absolute inset-x-0 bottom-14 z-30 flex justify-center px-2 transition-all duration-250 ease-out-expo lg:bottom-20 lg:px-4 ${
        open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div
        className={`w-full max-w-xl overflow-hidden rounded-xl border border-white/15 bg-white/10 text-ink-primary shadow-custom backdrop-blur-xl ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <EqualizerIcon size={16} />
            {t('settings.equalizer')}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPresetsOpen((v) => !v)}
              aria-expanded={presetsOpen}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-white/15 hover:text-ink-primary"
            >
              {audio.activePreset
                ? t(`settings.eq${audio.activePreset.charAt(0).toUpperCase()}${audio.activePreset.slice(1)}`)
                : t('settings.eqCustom')}
            </button>
            <button
              type="button"
              onClick={audio.setEqEnabled.bind(null, !audio.eqEnabled)}
              aria-pressed={audio.eqEnabled}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                audio.eqEnabled ? 'bg-brand' : 'bg-white/25'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  audio.eqEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Presets — collapsed by default so the bands own the panel. */}
        {presetsOpen && (
          <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-3 py-2">
            {EQ_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  audio.applyPreset(preset.id);
                  setPresetsOpen(false);
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  audio.activePreset === preset.id
                    ? 'bg-brand text-white'
                    : 'bg-white/10 text-ink-secondary hover:bg-white/20 hover:text-ink-primary'
                }`}
              >
                {audio.activePreset === preset.id && <CheckIcon size={11} />}
                {t(`settings.eq${preset.id.charAt(0).toUpperCase()}${preset.id.slice(1)}`)}
              </button>
            ))}
          </div>
        )}

        {/* Bands. Dimmed rather than unmounted when the EQ is bypassed, so the
            shape of the panel does not jump when it is toggled. */}
        <div
          className={`flex items-end justify-between gap-0.5 px-2 pb-1 pt-2 transition-opacity sm:gap-1 sm:px-3 ${
            audio.eqEnabled ? 'opacity-100' : 'opacity-35'
          }`}
        >
          {EQ_BANDS.map((freq, i) => (
            <BandSlider
              key={freq}
              freq={freq}
              gain={audio.gains[i] ?? 0}
              disabled={!audio.eqEnabled}
              onChange={(g) => audio.setBand(i, g)}
            />
          ))}
        </div>

        {/* Maximiser strip */}
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
          <button
            type="button"
            onClick={() => audio.setMaximizerEnabled(!audio.maximizerEnabled)}
            aria-pressed={audio.maximizerEnabled}
            aria-label={t('settings.maximizer')}
            className={`shrink-0 rounded p-1 transition-colors ${
              audio.maximizerEnabled ? 'text-brand' : 'text-ink-disabled hover:text-ink-secondary'
            }`}
          >
            <MaximizeAudioIcon size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audio.maximizer}
            disabled={!audio.maximizerEnabled}
            onChange={(e) => audio.setMaximizer(parseFloat(e.target.value))}
            aria-label={t('settings.maximizer')}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--brand)] disabled:cursor-not-allowed"
          />
          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-secondary">
            {audio.maximizer <= 0
              ? t('settings.maximizerOff')
              : `${Math.round(audio.maximizer * 100)}%`}
          </span>
          {/* Peak-reduction meter — shows the compressor actually working. */}
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/15 sm:block">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-200"
              style={{ width: `${Math.min(100, (audio.reduction / 24) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One vertical band. A `range` input with `writing-mode: vertical-lr` is the
 * accessible choice — arrow keys work and the value reaches assistive tech —
 * unlike a hand-rolled drag target. Height shrinks on small screens so ten
 * bands still fit a 320px viewport.
 */
function BandSlider({
  freq,
  gain,
  disabled,
  onChange,
}: {
  freq: number;
  gain: number;
  disabled?: boolean;
  onChange: (g: number) => void;
}) {
  const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <input
        type="range"
        min={-EQ_GAIN_LIMIT}
        max={EQ_GAIN_LIMIT}
        step={1}
        value={gain}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={`${label} Hz`}
        className="h-16 w-1.5 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--brand)] [direction:rtl] [writing-mode:vertical-lr] disabled:cursor-not-allowed sm:h-20"
      />
      <span className="text-[9px] tabular-nums text-ink-secondary sm:text-[10px]">{label}</span>
    </div>
  );
}
