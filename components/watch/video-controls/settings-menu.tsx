'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePlayer } from './player-context';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from './icons';

/**
 * Stacked-panel settings menu. The gear icon opens a slide-up panel. Root level
 * lists every adjustable thing the player actually supports, and each entry
 * opens a submenu that slides in from the right:
 *
 *   Speed          playback rate
 *   Quality        hls.js renditions (hidden when the manifest has one rung)
 *   Audio track    hls.js alternate audio (hidden when there is one)
 *   Subtitles      hls.js subtitle tracks + appearance (size, background, position)
 *   Audio          equaliser + volume maximiser
 *   Display        letterbox vs crop
 *   Auto-play next toggle
 *
 * Entries whose backing data is absent are not rendered at all — a menu item
 * that cannot do anything is worse than a missing one. Adding a panel means
 * one block in the root list and one `<Panel>`; the shape is unchanged.
 */
const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type Panel = 'root' | 'speed' | 'language' | 'server' | 'quality' | 'audioTrack' | 'subtitle' | 'audio' | 'fit';

export interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  /** Opens the keyboard-shortcut help overlay. */
  onShowShortcuts: () => void;
}

export default function SettingsMenu({ open, onClose, onShowShortcuts }: SettingsMenuProps) {
  const t = useTranslations('watch.player');
  const {
    state,
    actions,
    servers,
    currentServerIndex,
    onSwitchLanguage,
    autoPlayNext,
    setAutoPlayNext,
    hls,
    fitMode,
    setFitMode,
    subtitleStyle,
    setSubtitleStyle,
    audio,
    playbackProviders,
    currentPlaybackProviderId,
    onSelectPlaybackProvider,
  } = usePlayer();
  const [panel, setPanel] = useState<Panel>('root');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Only surface the keyboard-shortcuts entry where a physical keyboard is
  // likely (fine pointer = mouse/trackpad). Pointless on touch-only devices.
  const [hasKeyboard, setHasKeyboard] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    setHasKeyboard(window.matchMedia('(pointer: fine)').matches);
  }, []);

  // Reset to root when menu closes — better UX than persisting deep panel.
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setPanel('root'), 250);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Keyboard: ESC navigates back / closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (panel !== 'root') setPanel('root');
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, panel]);

  // Document-level pointerdown — closes the menu on clicks ANYWHERE outside
  // the panel (including outside the player itself). The in-player backdrop
  // handles clicks inside the player; this catches clicks on the page around
  // it. Listener is attached after the open state commits, so the gear-click
  // that opens the menu doesn't immediately close it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current && rootRef.current.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, onClose]);

  const currentServer = servers[currentServerIndex];

  return (
    <div
      // pb-20 / lg:pb-24 lifts the panel above the bottom bar (progress + 1
      // row of controls ≈ 80–96px) so it doesn't overlap the gear / fullscreen
      // icons. Right padding keeps it aligned with the bottom-bar right edge.
      className={`pointer-events-none absolute inset-0 z-30 flex items-end justify-end p-4 pb-20 transition-opacity duration-200 lg:p-6 lg:pb-24 ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden={!open}
    >
      {/* Backdrop — fades the rest, pointer-events live so click-outside dismisses. */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        onPointerDown={onClose}
      />

      {/* Panel. Width is capped to the viewport on phones (a fixed 288px
          panel plus padding overflows a 320px screen) and grows from there. */}
      <div
        ref={rootRef}
        role="menu"
        aria-label="Settings"
        className={`relative w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl bg-black/85 text-ink-primary shadow-custom backdrop-blur-md transition-all duration-250 ease-out-expo ${
          open ? 'pointer-events-auto translate-y-0 scale-100' : 'pointer-events-none translate-y-4 scale-95'
        }`}
      >
        {/* Root panel */}
        <Panel active={panel === 'root'} direction="left">
          <Row
            label={t('settings.speed')}
            value={state.playbackRate === 1 ? t('settings.normal') : `${state.playbackRate}×`}
            onClick={() => setPanel('speed')}
            trailing={<ChevronRightIcon size={18} />}
          />
          {servers.length > 1 && (
            <Row
              label={t('settings.language')}
              value={currentServer?.name ?? ''}
              onClick={() => setPanel('language')}
              trailing={<ChevronRightIcon size={18} />}
            />
          )}
          {playbackProviders.length > 1 && (
            <Row
              label={t('settings.server')}
              value={
                currentPlaybackProviderId
                  ? (playbackProviders.find((p) => p.id === currentPlaybackProviderId)?.name ?? '')
                  : t('settings.serverAuto')
              }
              onClick={() => setPanel('server')}
              trailing={<ChevronRightIcon size={18} />}
            />
          )}
          {hls.levels.length > 1 && (
            <Row
              label={t('settings.quality')}
              value={
                hls.currentLevel < 0
                  ? 'Auto'
                  : hls.levels.find((l) => l.id === hls.currentLevel)?.label ?? 'Auto'
              }
              onClick={() => setPanel('quality')}
              trailing={<ChevronRightIcon size={18} />}
            />
          )}
          {hls.audioTracks.length > 1 && (
            <Row
              label={t('settings.audioTrack')}
              value={hls.audioTracks.find((a) => a.id === hls.currentAudioTrack)?.label ?? ''}
              onClick={() => setPanel('audioTrack')}
              trailing={<ChevronRightIcon size={18} />}
            />
          )}
          {hls.subtitleTracks.length > 0 && (
            <Row
              label={t('settings.subtitle')}
              value={
                hls.currentSubtitleTrack < 0
                  ? t('settings.subtitleOff')
                  : hls.subtitleTracks.find((s) => s.id === hls.currentSubtitleTrack)?.label ?? ''
              }
              onClick={() => setPanel('subtitle')}
              trailing={<ChevronRightIcon size={18} />}
            />
          )}
          <Row
            label={t('settings.audio')}
            value={
              audio.eqEnabled && audio.maximizerEnabled
                ? `${t('settings.equalizer')} • ${Math.round(audio.maximizer * 100)}%`
                : t('settings.maximizerOff')
            }
            onClick={() => setPanel('audio')}
            trailing={<ChevronRightIcon size={18} />}
          />
          <Row
            label={t('settings.fit')}
            value={fitMode === 'cover' ? t('settings.fitCover') : t('settings.fitContain')}
            onClick={() => setPanel('fit')}
            trailing={<ChevronRightIcon size={18} />}
          />
          <ToggleRow
            label={t('settings.autoPlayNext')}
            checked={autoPlayNext}
            onChange={setAutoPlayNext}
          />
          {hasKeyboard && (
            <Row
              label={t('shortcuts.title')}
              onClick={() => {
                onClose();
                onShowShortcuts();
              }}
              trailing={
                <kbd className="rounded border border-white/15 bg-surface-chip px-1.5 py-0.5 text-[11px] font-semibold leading-none text-ink-primary">
                  ?
                </kbd>
              }
            />
          )}
        </Panel>

        {/* Speed panel */}
        <Panel active={panel === 'speed'} direction="right">
          <BackHeader title={t('settings.speed')} onBack={() => setPanel('root')} />
          {RATE_OPTIONS.map((rate) => (
            <RadioRow
              key={rate}
              label={rate === 1 ? t('settings.normal') : `${rate}×`}
              selected={state.playbackRate === rate}
              onClick={() => {
                actions.setRate(rate);
                setPanel('root');
              }}
            />
          ))}
        </Panel>

        {/* Language panel */}
        <Panel active={panel === 'language'} direction="right">
          <BackHeader title={t('settings.language')} onBack={() => setPanel('root')} />
          {servers.map((srv, idx) => (
            <RadioRow
              key={`${srv.name}-${idx}`}
              label={srv.name}
              selected={idx === currentServerIndex}
              onClick={() => {
                onSwitchLanguage(idx);
                setPanel('root');
                onClose();
              }}
            />
          ))}
        </Panel>

        {/* Server panel — the upstream aggregator's own server list. Picking
            one re-resolves the episode through it, which is the only way out
            when the server in use is missing the title or refusing this
            network. "Auto" hands the choice back to the aggregator. */}
        <Panel active={panel === 'server'} direction="right">
          <BackHeader title={t('settings.server')} onBack={() => setPanel('root')} />
          <RadioRow
            label={t('settings.serverAuto')}
            selected={currentPlaybackProviderId === null}
            onClick={() => {
              onSelectPlaybackProvider(null);
              setPanel('root');
            }}
          />
          {playbackProviders.map((p) => (
            <RadioRow
              key={p.id}
              label={p.tagline ? `${p.name} — ${p.tagline}` : p.name}
              selected={currentPlaybackProviderId === p.id}
              onClick={() => {
                onSelectPlaybackProvider(p.id);
                setPanel('root');
              }}
            />
          ))}
        </Panel>

        {/* Quality panel — hls.js renditions, "Auto" first. */}
        <Panel active={panel === 'quality'} direction="right">
          <BackHeader title={t('settings.quality')} onBack={() => setPanel('root')} />
          <RadioRow
            label="Auto"
            selected={hls.currentLevel < 0}
            onClick={() => hls.setLevel(-1)}
          />
          {[...hls.levels].reverse().map((lvl) => (
            <RadioRow
              key={lvl.id}
              label={lvl.label}
              selected={hls.currentLevel === lvl.id}
              onClick={() => hls.setLevel(lvl.id)}
            />
          ))}
        </Panel>

        {/* Audio-track panel — alternate dubs in the manifest. */}
        <Panel active={panel === 'audioTrack'} direction="right">
          <BackHeader title={t('settings.audioTrack')} onBack={() => setPanel('root')} />
          {hls.audioTracks.map((trk) => (
            <RadioRow
              key={trk.id}
              label={trk.label}
              selected={hls.currentAudioTrack === trk.id}
              onClick={() => hls.setAudioTrack(trk.id)}
            />
          ))}
        </Panel>

        {/* Subtitle panel — track choice plus appearance sliders. */}
        <Panel active={panel === 'subtitle'} direction="right">
          <BackHeader title={t('settings.subtitle')} onBack={() => setPanel('root')} />
          <RadioRow
            label={t('settings.subtitleOff')}
            selected={hls.currentSubtitleTrack < 0}
            onClick={() => hls.setSubtitleTrack(-1)}
          />
          {hls.subtitleTracks.map((trk) => (
            <RadioRow
              key={trk.id}
              label={trk.label}
              selected={hls.currentSubtitleTrack === trk.id}
              onClick={() => hls.setSubtitleTrack(trk.id)}
            />
          ))}
          <Divider />
          <SliderRow
            label={t('settings.subScale')}
            value={subtitleStyle.scale}
            min={0.75}
            max={2}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => setSubtitleStyle({ scale: v })}
          />
          <SliderRow
            label={t('settings.subBackground')}
            value={subtitleStyle.background}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => setSubtitleStyle({ background: v })}
          />
          <SliderRow
            label={t('settings.subPosition')}
            value={subtitleStyle.position}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => setSubtitleStyle({ position: v })}
          />
        </Panel>

        {/* Audio panel. The equaliser itself lives on the player surface
            (EqualizerPanel) because tuning bands wants the picture visible;
            this entry only carries the on/off state and points there. */}
        <Panel active={panel === 'audio'} direction="right">
          <BackHeader title={t('settings.audio')} onBack={() => setPanel('root')} />
          {!audio.available ? (
            <p className="px-4 py-3 text-xs text-ink-secondary">{t('settings.eqUnavailable')}</p>
          ) : (
            <>
              <ToggleRow
                label={t('settings.equalizer')}
                checked={audio.eqEnabled}
                onChange={audio.setEqEnabled}
              />
              <p className="px-4 pb-3 text-[11px] leading-relaxed text-ink-secondary">
                {t('settings.eqHint')}
              </p>
              <Divider />
              <ToggleRow
                label={t('settings.maximizer')}
                checked={audio.maximizerEnabled}
                onChange={audio.setMaximizerEnabled}
              />
              <SliderRow
                label={t('settings.maximizer')}
                value={audio.maximizer}
                min={0}
                max={1}
                step={0.05}
                format={(v) => (v <= 0 ? t('settings.maximizerOff') : `${Math.round(v * 100)}%`)}
                onChange={audio.setMaximizer}
              />
              {/* Peak-reduction meter: shows the compressor working. */}
              <div className="flex items-center gap-2 px-4 pb-4">
                <span className="text-[11px] text-ink-secondary">{t('settings.reduction')}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-200"
                    style={{ width: `${Math.min(100, (audio.reduction / 24) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[11px] tabular-nums text-ink-secondary">
                  {audio.reduction.toFixed(1)} dB
                </span>
              </div>
            </>
          )}
        </Panel>

        {/* Display panel — letterbox vs crop. */}
        <Panel active={panel === 'fit'} direction="right">
          <BackHeader title={t('settings.fit')} onBack={() => setPanel('root')} />
          <RadioRow
            label={t('settings.fitContain')}
            selected={fitMode === 'contain'}
            onClick={() => {
              setFitMode('contain');
              setPanel('root');
            }}
          />
          <RadioRow
            label={t('settings.fitCover')}
            selected={fitMode === 'cover'}
            onClick={() => {
              setFitMode('cover');
              setPanel('root');
            }}
          />
        </Panel>
      </div>
    </div>
  );
}

// ---- Building blocks ----

/** Section separator inside a panel. */
function Divider() {
  return <div className="my-1 border-t border-white/10" />;
}

/** Horizontal 0–1 slider with a right-aligned readout. */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-20 shrink-0 text-sm font-medium text-ink-primary">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--brand)]"
      />
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-secondary">
        {format(value)}
      </span>
    </label>
  );
}

function Panel({
  active,
  direction,
  children,
}: {
  active: boolean;
  direction: 'left' | 'right';
  children: React.ReactNode;
}) {
  // Stacked panels use absolute positioning + slide-in. The active panel
  // dictates the menu's measured height via `relative`.
  return (
    <div
      className={`${
        active ? 'relative' : 'absolute inset-0'
      } transition-transform duration-200 ease-out-expo ${
        active ? 'translate-x-0' : direction === 'right' ? 'translate-x-full' : '-translate-x-full'
      } ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="py-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  onClick,
  trailing,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:bg-surface-chip focus-visible:bg-surface-chip"
    >
      <span className="font-medium text-ink-primary">{label}</span>
      <span className="flex items-center gap-2 text-ink-secondary">
        {value}
        {trailing}
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:bg-surface-chip focus-visible:bg-surface-chip"
      aria-pressed={checked}
    >
      <span className="font-medium text-ink-primary">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
          checked ? 'bg-brand' : 'bg-white/25'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function RadioRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:bg-surface-chip focus-visible:bg-surface-chip ${
        selected ? 'text-ink-primary' : 'text-ink-secondary'
      }`}
      role="menuitemradio"
      aria-checked={selected}
    >
      <span className="font-medium">{label}</span>
      {selected && <CheckIcon size={18} className="text-brand" />}
    </button>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left text-sm font-semibold text-ink-primary outline-none transition-colors hover:bg-surface-chip focus-visible:bg-surface-chip"
    >
      <ChevronLeftIcon size={18} />
      <span>{title}</span>
    </button>
  );
}
