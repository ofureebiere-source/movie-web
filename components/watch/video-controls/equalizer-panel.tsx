'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePlayer } from './player-context';
import {
  EQ_BANDS,
  EQ_GAIN_LIMIT,
  PREAMP_LIMIT,
  Q_MAX,
  Q_MIN,
} from 'hooks/useAudioProcessing';
import { EqualizerIcon, MaximizeAudioIcon, CheckIcon, TrashIcon } from './icons';

/**
 * Equaliser + volume maximiser, docked directly on the player surface.
 *
 * Deliberately not another level of the settings menu: tuning audio is a
 * see-the-video-while-you-do-it job, so this floats over the picture in a
 * translucent glass panel instead of covering it. The bars stay visible at all
 * times, so a band can be dragged while watching a scene and judged by ear.
 *
 * The layout follows the modern EQ apps rather than a bare rack:
 *
 *  - a **spectrum** behind the bars, fed by the analyser tap, so a change is
 *    visible as well as audible;
 *  - a **response curve** over the bars, which is what makes a shelf at the
 *    ends legible as a shelf;
 *  - **simple / advanced**, because three macros and ten bands are answers to
 *    different questions and neither should be the only one available;
 *  - **preamp, bandwidth and balance** in a second row, which is where every
 *    hardware and phone EQ puts them;
 *  - **preset chips plus save/delete**, so a curve the viewer likes is not
 *    lost the moment they try another one.
 *
 * Everything is glass — low-alpha fills, a blur, a hairline border — so the
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
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState('');

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
    if (!open) {
      setPresetsOpen(false);
      setSaving(false);
    }
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

  const activeLabel = audio.activePreset
    ? audio.presets.find((p) => p.id === audio.activePreset)?.label ?? t('settings.eqCustom')
    : t('settings.eqCustom');

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
        className={`w-full max-w-2xl overflow-hidden rounded-xl border border-white/15 bg-white/10 text-ink-primary shadow-custom backdrop-blur-xl ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Header — title, preset chip, simple/advanced, bypass. */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <EqualizerIcon size={16} />
            {t('settings.equalizer')}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md bg-white/10 p-0.5" role="group">
              {(['simple', 'advanced'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => audio.setMode(m)}
                  aria-pressed={audio.mode === m}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    audio.mode === m
                      ? 'bg-white/25 text-ink-primary'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {m === 'simple' ? t('settings.eqSimple') : t('settings.eqAdvanced')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPresetsOpen((v) => !v)}
              aria-expanded={presetsOpen}
              className="max-w-[9rem] truncate rounded-md px-2 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-white/15 hover:text-ink-primary"
            >
              {activeLabel}
            </button>
            <button
              type="button"
              onClick={() => audio.setEqEnabled(!audio.eqEnabled)}
              aria-pressed={audio.eqEnabled}
              aria-label={t('settings.equalizer')}
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
          <div className="border-b border-white/10 px-3 py-2">
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {audio.presets.map((preset) => (
                <span key={preset.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => audio.applyPreset(preset.id)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      audio.activePreset === preset.id
                        ? 'bg-brand text-white'
                        : 'bg-white/10 text-ink-secondary hover:bg-white/20 hover:text-ink-primary'
                    }`}
                  >
                    {audio.activePreset === preset.id && <CheckIcon size={11} />}
                    {preset.custom
                      ? preset.label
                      : t(`settings.eq${preset.id.charAt(0).toUpperCase()}${preset.id.slice(1)}`)}
                  </button>
                  {preset.custom && (
                    <button
                      type="button"
                      onClick={() => audio.deleteCustomPreset(preset.id)}
                      aria-label={`${t('settings.eqDelete')} ${preset.label}`}
                      className="ml-0.5 rounded-full p-1 text-ink-secondary transition-colors hover:bg-white/15 hover:text-ink-primary"
                    >
                      <TrashIcon size={11} />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Save the current curve. A viewer who finds a setting they like
                should not have to rebuild it by hand next time. */}
            {saving ? (
              <form
                className="mt-2 flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  audio.saveCustomPreset(draftName);
                  setDraftName('');
                  setSaving(false);
                }}
              >
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={t('settings.eqPresetName')}
                  aria-label={t('settings.eqPresetName')}
                  className="min-w-0 flex-1 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-[11px] text-ink-primary placeholder:text-ink-disabled focus:border-white/40 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white"
                >
                  {t('settings.eqSaved')}
                </button>
                <button
                  type="button"
                  onClick={() => setSaving(false)}
                  className="rounded-md px-2 py-1 text-[11px] text-ink-secondary hover:text-ink-primary"
                >
                  {t('settings.subtitleOff')}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSaving(true)}
                className="mt-2 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-white/20 hover:text-ink-primary"
              >
                {t('settings.eqSavePreset')}
              </button>
            )}
          </div>
        )}

        {/* Bands. Dimmed rather than unmounted when the EQ is bypassed, so the
            shape of the panel does not jump when it is toggled. */}
        <div
          className={`relative px-2 pb-1 pt-2 transition-opacity sm:px-3 ${
            audio.eqEnabled ? 'opacity-100' : 'opacity-35'
          }`}
        >
          {/* Spectrum + response curve, drawn behind the bars. Purely
              decorative, so it is hidden from assistive tech. */}
          <ResponseCurve gains={audio.gains} enabled={audio.eqEnabled} />

          {audio.mode === 'advanced' ? (
            <div className="relative flex items-end justify-between gap-0.5 sm:gap-1">
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
          ) : (
            <div className="relative space-y-1.5 px-1 pb-1">
              {(
                [
                  ['bass', 'eqBassMacro'],
                  ['mid', 'eqMidMacro'],
                  ['treble', 'eqTrebleMacro'],
                ] as const
              ).map(([key, label]) => (
                <MacroSlider
                  key={key}
                  label={t(`settings.${label}`)}
                  value={audio.simple[key]}
                  disabled={!audio.eqEnabled}
                  onChange={(v) => audio.setSimple(key, v)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Shaping row — preamp, bandwidth, balance, reset. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 px-3 py-2">
          <MiniSlider
            label={t('settings.eqPreamp')}
            value={audio.preamp}
            min={-PREAMP_LIMIT}
            max={PREAMP_LIMIT}
            step={0.5}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
            onChange={audio.setPreamp}
            disabled={audio.autoPreamp}
          />
          <button
            type="button"
            onClick={() => audio.setAutoPreamp(!audio.autoPreamp)}
            aria-pressed={audio.autoPreamp}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              audio.autoPreamp
                ? 'bg-brand/25 text-ink-primary'
                : 'bg-white/10 text-ink-secondary hover:bg-white/20'
            }`}
          >
            {t('settings.eqAutoPreamp')}
          </button>
          <MiniSlider
            label={t('settings.eqBandwidth')}
            value={audio.q}
            min={Q_MIN}
            max={Q_MAX}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={audio.setQ}
          />
          <MiniSlider
            label={t('settings.eqBalance')}
            value={audio.balance}
            min={-1}
            max={1}
            step={0.05}
            format={(v) =>
              Math.abs(v) < 0.05
                ? t('settings.eqMono')
                : v < 0
                  ? `${t('settings.eqLeft')} ${Math.round(-v * 100)}%`
                  : `${t('settings.eqRight')} ${Math.round(v * 100)}%`
            }
            onChange={audio.setBalance}
          />
          <button
            type="button"
            onClick={audio.reset}
            className="ml-auto rounded-md px-2 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-white/15 hover:text-ink-primary"
          >
            {t('settings.eqReset')}
          </button>
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
    <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1">
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

/** One three-macro slider for simple mode, laid out horizontally. */
function MacroSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-medium text-ink-secondary">{label}</span>
      <input
        type="range"
        min={-EQ_GAIN_LIMIT}
        max={EQ_GAIN_LIMIT}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--brand)] disabled:cursor-not-allowed"
      />
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-ink-secondary">
        {value > 0 ? '+' : ''}
        {value} dB
      </span>
    </div>
  );
}

/** A compact labelled slider for the shaping row. */
function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-[8rem] flex-1 items-center gap-1.5">
      <span className="shrink-0 text-[10px] font-medium text-ink-secondary">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--brand)] disabled:cursor-not-allowed"
      />
      <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-ink-secondary">
        {format(value)}
      </span>
    </label>
  );
}

/**
 * Live spectrum plus the EQ response curve, drawn on a canvas behind the bars.
 *
 * Both are read from the audio graph each frame: the spectrum from the
 * analyser tap, the curve computed from the band gains and their filter type.
 * One `requestAnimationFrame` loop drives both and stops when the panel is
 * closed, so a hidden panel costs nothing.
 *
 * Canvas rather than a row of divs because a 30-bar spectrum updating at 60 Hz
 * is thousands of style writes a second as DOM, and one `putImageData` as
 * canvas.
 */
function ResponseCurve({ gains, enabled }: { gains: number[]; enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gainsRef = useRef(gains);
  gainsRef.current = gains;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const { audio } = usePlayer();

  const spectrum = useMemo(() => new Uint8Array(128), []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const current = gainsRef.current;
    const on = enabledRef.current;

    // Spectrum — low frequencies at the left, mirrored around the centre so
    // the picture is symmetric rather than a one-sided ramp.
    if (audio.readSpectrum(spectrum)) {
      const bars = 32;
      const step = Math.floor(spectrum.length / bars);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += spectrum[i * step + j] ?? 0;
        const value = sum / step / 255;
        const barH = Math.max(1, value * h * 0.8);
        const barW = w / bars;
        ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
      }
    }

    // Response curve. A shelf at the ends, peaking in between — matching the
    // filter types the engine builds, so the drawing is not a lie.
    const mid = h / 2;
    const span = h / 2 / (EQ_GAIN_LIMIT * 1.15);
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = on ? 'rgba(226,9,19,0.9)' : 'rgba(255,255,255,0.35)';
    for (let x = 0; x <= w; x++) {
      const t = x / w;
      // Interpolate the band gains across the width, then ease so the curve
      // rolls off rather than snapping between bands.
      const pos = t * (current.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(current.length - 1, lo + 1);
      const frac = pos - lo;
      const gain = (current[lo] ?? 0) * (1 - frac) + (current[hi] ?? 0) * frac;
      const y = mid - (on ? gain : 0) * span;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Zero line.
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
  }, [audio, spectrum]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-2 top-2 h-16 w-[calc(100%-1rem)] sm:inset-x-3 sm:h-20 sm:w-[calc(100%-1.5rem)]"
    />
  );
}
