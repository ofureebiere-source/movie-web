'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Graphic equaliser + volume maximiser, built on the Web Audio API.
 *
 * The graph is
 *
 *     <video> ──▶ MediaElementSource ──▶ EQ band 1..N ──▶ compressor ──▶ makeup gain ──▶ out
 *
 * with every stage bypassable. Two things are worth explaining:
 *
 *  - **The maximiser is a compressor, not a gain.** Simply multiplying the
 *    signal clips; what actually makes quiet dialogue audible is squashing the
 *    peaks and then lifting the whole signal back up, which is what a
 *    DynamicsCompressorNode plus a makeup gain does. The "strength" control
 *    drives both at once — threshold down and makeup up together — so one
 *    slider behaves the way people expect.
 *
 *  - **A MediaElementSource can be created once per element, ever.** Re-running
 *    the setup on the same <video> throws `InvalidStateError`, so the source is
 *    created once and kept in a ref, and re-connecting after a stream change
 *    only re-uses it. It also means the graph must survive HLS teardown: hls.js
 *    swaps the media via MSE on the same element, so the element identity is
 *    stable and the graph stays valid.
 *
 * If Web Audio is unavailable, or the media is cross-origin without CORS (in
 * which case the graph outputs silence — a silent player is far worse than no
 * EQ), the whole thing disables itself and reports `unavailable` rather than
 * breaking playback.
 */

/** Centre frequencies, in Hz — the usual 10-band layout. */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/** Gain limits, in dB, for a single band. */
export const EQ_GAIN_LIMIT = 12;

/** A preset is a full set of gains, one per band, in dB. */
export interface EqPreset {
  id: string;
  label: string;
  gains: number[];
}

const FLAT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', label: 'Phẳng', gains: FLAT },
  { id: 'bass', label: 'Tăng bass', gains: [8, 7, 5, 3, 1, 0, 0, 0, 0, 0] },
  { id: 'vocal', label: 'Giọng nói', gains: [-3, -2, 0, 2, 4, 5, 4, 2, 0, -2] },
  { id: 'cinema', label: 'Rạp phim', gains: [5, 4, 2, 0, -1, 0, 2, 3, 4, 3] },
  { id: 'night', label: 'Ban đêm', gains: [-4, -3, -1, 1, 3, 4, 3, 1, -1, -3] },
];

export interface AudioController {
  /** False when the graph could not be built (unsupported, or tainted media). */
  available: boolean;
  /** Human-readable reason when `available` is false. */
  unavailableReason: string | null;
  /** Per-band gains in dB, index-aligned with `EQ_BANDS`. */
  gains: number[];
  setBand: (index: number, gainDb: number) => void;
  /** Replace every band at once (preset). */
  setGains: (gains: number[]) => void;
  applyPreset: (presetId: string) => void;
  /** Id of the preset the current gains match, or null when custom. */
  activePreset: string | null;
  /** Master bypass for the EQ stages. */
  eqEnabled: boolean;
  setEqEnabled: (v: boolean) => void;

  /** Loudness maximiser strength, 0 (off) – 1 (aggressive). */
  maximizer: number;
  setMaximizer: (v: number) => void;
  /** Whether the maximiser stage is engaged at all. */
  maximizerEnabled: boolean;
  setMaximizerEnabled: (v: boolean) => void;
  /** Live gain reduction in dB (0 = none), for the meter in the menu. */
  reduction: number;
}

const DEFAULT_GAINS = FLAT;

/** Compressor settings per strength, interpolated between these two ends. */
function compressorFor(strength: number) {
  const s = Math.max(0, Math.min(1, strength));
  // 0 → gentle levelling; 1 → hard limiting. Threshold sweeps −12 → −40 dB,
  // ratio 2 → 12, and the makeup gain lifts the squashed signal back up.
  return {
    threshold: -12 - 28 * s,
    ratio: 2 + 10 * s,
    makeup: 1 + 2.2 * s,
  };
}

export function useAudioProcessing(
  videoRef: React.RefObject<HTMLVideoElement | null>
): AudioController {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const makeupRef = useRef<GainNode | null>(null);
  /** The element the graph is bound to, so a swapped <video> is detected. */
  const boundElRef = useRef<HTMLVideoElement | null>(null);

  const [available, setAvailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [gains, setGainsState] = useState<number[]>(DEFAULT_GAINS);
  const [eqEnabled, setEqEnabledState] = useState(true);
  const [maximizer, setMaximizerState] = useState(0.5);
  const [maximizerEnabled, setMaximizerEnabledState] = useState(true);
  const [reduction, setReduction] = useState(0);

  const build = useCallback(() => {
    const video = videoRef.current;
    if (!video) return false;
    if (boundElRef.current === video && sourceRef.current) return true;

    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as any).webkitAudioContext
        : undefined;
    if (!Ctor) {
      setUnavailableReason('unsupported');
      return false;
    }

    try {
      const ctx: AudioContext = ctxRef.current ?? new Ctor();
      ctxRef.current = ctx;

      // One source per element, for the element's whole life.
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(video);
      }
      const source = sourceRef.current;

      const filters = EQ_BANDS.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        // Ends of the range are shelves; the middle is peaking. That is what
        // keeps the extreme bands from sounding thin.
        f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = gains[i] ?? 0;
        return f;
      });

      const compressor = ctx.createDynamicsCompressor();
      const makeup = ctx.createGain();

      // source → f1 → … → fN → compressor → makeup → destination
      let node: AudioNode = source;
      filters.forEach((f) => {
        node.connect(f);
        node = f;
      });
      node.connect(compressor);
      compressor.connect(makeup);
      makeup.connect(ctx.destination);

      filtersRef.current = filters;
      compressorRef.current = compressor;
      makeupRef.current = makeup;
      boundElRef.current = video;

      // A suspended context outputs nothing; resuming needs a user gesture,
      // which playback always provides.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setAvailable(true);
      setUnavailableReason(null);
      return true;
    } catch {
      // Most often a cross-origin element, which would output silence. Better
      // to leave the audio path untouched than to mute the film.
      setAvailable(false);
      setUnavailableReason('blocked');
      return false;
    }
  }, [videoRef, gains]);

  // Build once the element exists, and again if it is ever replaced.
  useEffect(() => {
    build();
    const video = videoRef.current;
    if (!video) return;
    // `loadedmetadata` is the earliest point the graph can safely attach.
    const onReady = () => build();
    video.addEventListener('loadedmetadata', onReady);
    return () => video.removeEventListener('loadedmetadata', onReady);
  }, [build, videoRef]);

  // Push EQ gains to the filters.
  useEffect(() => {
    const filters = filtersRef.current;
    if (!filters.length) return;
    filters.forEach((f, i) => {
      // Bypassed EQ flattens every band rather than disconnecting the graph —
      // cheaper, and keeps the node chain intact.
      f.gain.value = eqEnabled ? gains[i] ?? 0 : 0;
    });
  }, [gains, eqEnabled]);

  // Push maximiser settings.
  useEffect(() => {
    const compressor = compressorRef.current;
    const makeup = makeupRef.current;
    if (!compressor || !makeup) return;
    if (!maximizerEnabled || maximizer <= 0) {
      // Neutral: unity gain, compressor effectively inert.
      compressor.threshold.value = 0;
      compressor.ratio.value = 1;
      makeup.gain.value = 1;
      setReduction(0);
      return;
    }
    const { threshold, ratio, makeup: m } = compressorFor(maximizer);
    compressor.threshold.value = threshold;
    compressor.ratio.value = ratio;
    makeup.gain.value = m;
  }, [maximizer, maximizerEnabled]);

  // Gain-reduction meter. Polled rather than event-driven because the
  // compressor exposes no change event; 4 Hz is enough for a level bar and
  // costs nothing.
  useEffect(() => {
    if (!available || !maximizerEnabled || maximizer <= 0) return;
    const id = setInterval(() => {
      const c = compressorRef.current;
      if (c) setReduction(Math.max(0, -c.reduction));
    }, 250);
    return () => clearInterval(id);
  }, [available, maximizerEnabled, maximizer]);

  // Release the context when the player unmounts.
  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      sourceRef.current = null;
      filtersRef.current = [];
      compressorRef.current = null;
      makeupRef.current = null;
      boundElRef.current = null;
    };
  }, []);

  const setBand = useCallback((index: number, gainDb: number) => {
    setGainsState((prev) => {
      const next = [...prev];
      next[index] = Math.max(-EQ_GAIN_LIMIT, Math.min(EQ_GAIN_LIMIT, gainDb));
      return next;
    });
  }, []);

  const setGains = useCallback((next: number[]) => {
    setGainsState(EQ_BANDS.map((_, i) => next[i] ?? 0));
  }, []);

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = EQ_PRESETS.find((p) => p.id === presetId);
      if (preset) setGains(preset.gains);
    },
    [setGains]
  );

  // A preset is "active" only while the gains still match it exactly.
  const activePreset =
    EQ_PRESETS.find((p) => p.gains.every((g, i) => Math.abs(g - (gains[i] ?? 0)) < 0.01))?.id ??
    null;

  return {
    available,
    unavailableReason,
    gains,
    setBand,
    setGains,
    applyPreset,
    activePreset,
    eqEnabled,
    setEqEnabled: setEqEnabledState,
    maximizer,
    setMaximizer: setMaximizerState,
    maximizerEnabled,
    setMaximizerEnabled: setMaximizerEnabledState,
    reduction,
  };
}
