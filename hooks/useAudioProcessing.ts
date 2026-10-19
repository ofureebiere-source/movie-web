'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Graphic equaliser + loudness maximiser, built on the Web Audio API.
 *
 * The graph is
 *
 *   <video> ─▶ source ─▶ preamp ─▶ band 1..N ─▶ balance ─▶ compressor ─▶ makeup ─▶ out
 *                                                              └────▶ analyser (tap)
 *
 * Every stage is bypassable and the whole thing degrades to "no EQ" rather
 * than to silence. The pieces that make it behave like a modern EQ rather
 * than a bare bank of filters:
 *
 *  - **Preamp.** Boosting bands adds energy; without a compensating trim the
 *    sum clips before it reaches the compressor. The preamp is that trim, and
 *    `autoPreamp` keeps it at the inverse of the largest boost so a preset can
 *    never clip on its own.
 *  - **Per-band Q.** A single bandwidth control, as on hardware graphic EQs.
 *    Shelves at the ends, peaking in between — the ends of the spectrum want a
 *    shelf or they sound thin.
 *  - **Simple / advanced.** Three macros (bass, mid, treble) for the people
 *    who want the consumer-app control, and the ten bands for everyone else.
 *    The macros write into the same bands, so there is one engine, not two.
 *  - **Analyser.** An FFT tap feeding the spectrum drawn behind the bands, so
 *    a change is visible as well as audible.
 *  - **Balance.** Stereo pan, because a phone held on its side is not
 *    symmetric.
 *
 * Two constraints shape the code:
 *
 *  - **The maximiser is a compressor, not a gain.** Multiplying the signal
 *    clips; what makes quiet dialogue audible is squashing the peaks and then
 *    lifting the whole signal back up, which is a DynamicsCompressorNode plus
 *    a makeup gain. One "strength" control drives both together.
 *
 *  - **A MediaElementSource can be created once per element, ever.**
 *    Re-running setup on the same <video> throws `InvalidStateError`, so the
 *    source is created once and kept, and the graph is only rebuilt when the
 *    element identity actually changes. hls.js swaps media via MSE on the same
 *    element, so the graph survives stream changes.
 *
 * If Web Audio is unavailable, or the media is cross-origin without CORS (the
 * graph would then output silence — far worse than no EQ), the whole thing
 * reports `unavailable` instead of breaking playback.
 */

/** Centre frequencies, in Hz — the usual 10-band layout. */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/** Gain limits, in dB, for a single band. */
export const EQ_GAIN_LIMIT = 12;

/** Preamp trim range, in dB. */
export const PREAMP_LIMIT = 12;

/** Bandwidth range for the peaking bands. Low Q = wide, high Q = narrow. */
export const Q_MIN = 0.3;
export const Q_MAX = 4;

/** A preset is a full set of gains, one per band, in dB. */
export interface EqPreset {
  id: string;
  label: string;
  gains: number[];
  /** True for presets the viewer saved, which can be deleted. */
  custom?: boolean;
}

const FLAT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Three-macro control values, each in dB. */
export interface SimpleBands {
  bass: number;
  mid: number;
  treble: number;
}

const FLAT_SIMPLE: SimpleBands = { bass: 0, mid: 0, treble: 0 };

/**
 * The built-in preset library.
 *
 * Deliberately broad: a "modern EQ" is judged on whether the preset someone
 * reaches for exists, and the consumer libraries that ship with phones and
 * streaming clients all carry roughly this set. Ids are stable — the
 * translation keys and the custom-preset store key off them.
 */
export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', label: 'Phẳng', gains: FLAT },
  { id: 'acoustic', label: 'Acoustic', gains: [4, 4, 3, 1, 0, 0, 1, 2, 3, 3] },
  { id: 'bass', label: 'Tăng bass', gains: [9, 8, 6, 3, 1, 0, 0, 0, 0, 0] },
  { id: 'bassTreble', label: 'Bass & Treble', gains: [7, 6, 4, 1, 0, -1, 0, 2, 4, 5] },
  { id: 'classical', label: 'Cổ điển', gains: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4] },
  { id: 'dance', label: 'Dance', gains: [6, 5, 3, 0, 0, -2, -2, 1, 4, 5] },
  { id: 'electronic', label: 'Điện tử', gains: [5, 4, 1, 0, -1, 1, 2, 3, 5, 6] },
  { id: 'hiphop', label: 'Hip-Hop', gains: [8, 7, 4, 1, 0, -1, -1, 1, 2, 3] },
  { id: 'jazz', label: 'Jazz', gains: [4, 3, 2, 1, -1, -1, 0, 1, 2, 3] },
  { id: 'loudness', label: 'Loudness', gains: [7, 6, 3, 0, -2, -1, 0, 3, 5, 6] },
  { id: 'lounge', label: 'Lounge', gains: [-3, -2, -1, 1, 3, 2, 0, -1, 1, 2] },
  { id: 'party', label: 'Party', gains: [6, 5, 2, 0, 1, 2, 3, 4, 5, 4] },
  { id: 'pop', label: 'Pop', gains: [-1, -1, 0, 2, 4, 4, 2, 0, -1, -1] },
  { id: 'rock', label: 'Rock', gains: [5, 4, 2, 0, -1, -1, 1, 3, 4, 4] },
  { id: 'treble', label: 'Tăng treble', gains: [0, 0, 0, 0, 0, 0, 2, 4, 6, 7] },
  { id: 'vocal', label: 'Giọng nói', gains: [-3, -2, 0, 2, 4, 5, 4, 2, 0, -2] },
  { id: 'podcast', label: 'Podcast', gains: [-4, -3, 0, 3, 4, 4, 3, 1, -1, -3] },
  { id: 'cinema', label: 'Rạp phim', gains: [5, 4, 2, 0, -1, 0, 2, 3, 4, 3] },
  { id: 'tv', label: 'Loa TV', gains: [3, 4, 5, 3, 1, 1, 2, 3, 3, 2] },
  { id: 'gaming', label: 'Game', gains: [4, 3, 1, 0, -1, 1, 3, 4, 5, 4] },
  { id: 'night', label: 'Ban đêm', gains: [-4, -3, -1, 1, 3, 4, 3, 1, -1, -3] },
];

const CUSTOM_KEY = 'mw_eq_custom_presets';
const PREFS_KEY = 'mw_eq_prefs';

export interface AudioController {
  /** False when the graph could not be built (unsupported, or tainted media). */
  available: boolean;
  /** Human-readable reason when `available` is false. */
  unavailableReason: string | null;

  // ---- Bands ----
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
  /** Flat again, in whichever mode is active. */
  reset: () => void;

  // ---- Shaping ----
  /** Output trim in dB, applied before the bands. */
  preamp: number;
  setPreamp: (v: number) => void;
  /** Keep the preamp at the inverse of the largest boost, so nothing clips. */
  autoPreamp: boolean;
  setAutoPreamp: (v: boolean) => void;
  /** Bandwidth of the peaking bands. */
  q: number;
  setQ: (v: number) => void;
  /** Stereo balance, -1 (left) – 1 (right). */
  balance: number;
  setBalance: (v: number) => void;

  // ---- Simple / advanced ----
  mode: 'simple' | 'advanced';
  setMode: (m: 'simple' | 'advanced') => void;
  simple: SimpleBands;
  setSimple: (key: keyof SimpleBands, v: number) => void;

  // ---- Maximiser ----
  maximizer: number;
  setMaximizer: (v: number) => void;
  maximizerEnabled: boolean;
  setMaximizerEnabled: (v: boolean) => void;
  /** Live gain reduction in dB (0 = none), for the meter in the menu. */
  reduction: number;

  // ---- Metering ----
  /** Every preset available: the built-ins plus the viewer's saved ones. */
  presets: EqPreset[];
  /** Persist the current gains under a viewer-chosen name. */
  saveCustomPreset: (label: string) => void;
  deleteCustomPreset: (id: string) => void;
  /** Fill `target` with the live FFT magnitudes. False when there is no tap. */
  readSpectrum: (target: Uint8Array) => boolean;
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

/**
 * Which bands each macro drives. Bass owns the three lowest, treble the three
 * highest, and mid takes the four between — the split consumer EQs use.
 */
const SIMPLE_GROUPS: Record<keyof SimpleBands, number[]> = {
  bass: [0, 1, 2],
  mid: [3, 4, 5, 6],
  treble: [7, 8, 9],
};

/** Expand the three macros into a full band set. */
function gainsFromSimple(simple: SimpleBands): number[] {
  return EQ_BANDS.map((_, i) => {
    for (const key of Object.keys(SIMPLE_GROUPS) as (keyof SimpleBands)[]) {
      if (SIMPLE_GROUPS[key].includes(i)) return simple[key];
    }
    return 0;
  });
}

/** Best-effort inverse: average each macro's bands back out of a band set. */
function simpleFromGains(gains: number[]): SimpleBands {
  const average = (indices: number[]) =>
    indices.reduce((sum, i) => sum + (gains[i] ?? 0), 0) / indices.length;
  return {
    bass: average(SIMPLE_GROUPS.bass),
    mid: average(SIMPLE_GROUPS.mid),
    treble: average(SIMPLE_GROUPS.treble),
  };
}

function loadCustomPresets(): EqPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EqPreset[];
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.gains))
      : [];
  } catch {
    return [];
  }
}

function loadPrefs(): { autoPreamp?: boolean; mode?: 'simple' | 'advanced' } {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as ReturnType<typeof loadPrefs>) : {};
  } catch {
    return {};
  }
}

export function useAudioProcessing(
  videoRef: React.RefObject<HTMLVideoElement | null>
): AudioController {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const preampRef = useRef<GainNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const makeupRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  /** The element the graph is bound to, so a swapped <video> is detected. */
  const boundElRef = useRef<HTMLVideoElement | null>(null);

  const [available, setAvailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [gains, setGainsState] = useState<number[]>(DEFAULT_GAINS);
  const [eqEnabled, setEqEnabledState] = useState(true);
  const [preamp, setPreampState] = useState(0);
  const [autoPreamp, setAutoPreampState] = useState(true);
  const [q, setQState] = useState(1);
  const [balance, setBalanceState] = useState(0);
  const [mode, setModeState] = useState<'simple' | 'advanced'>('advanced');
  const [simple, setSimpleState] = useState<SimpleBands>(FLAT_SIMPLE);
  const [maximizer, setMaximizerState] = useState(0.5);
  const [maximizerEnabled, setMaximizerEnabledState] = useState(true);
  const [reduction, setReduction] = useState(0);
  const [customPresets, setCustomPresets] = useState<EqPreset[]>([]);

  // Preferences and saved presets live in the browser only.
  useEffect(() => {
    const prefs = loadPrefs();
    if (typeof prefs.autoPreamp === 'boolean') setAutoPreampState(prefs.autoPreamp);
    if (prefs.mode === 'simple' || prefs.mode === 'advanced') setModeState(prefs.mode);
    setCustomPresets(loadCustomPresets());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ autoPreamp, mode }));
    } catch {
      // Preference storage is an optimisation only.
    }
  }, [autoPreamp, mode]);

  const presets = useMemo(() => [...EQ_PRESETS, ...customPresets], [customPresets]);

  // In simple mode the macros are the source of truth and they write the
  // bands. The bands stay the single thing the filters read, so there is no
  // second code path to keep in sync.
  useEffect(() => {
    if (mode !== 'simple') return;
    setGainsState(gainsFromSimple(simple));
  }, [mode, simple]);

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

      const preampNode = ctx.createGain();
      const filters = EQ_BANDS.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        // Ends of the range are shelves; the middle is peaking. That is what
        // keeps the extreme bands from sounding thin.
        f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        f.frequency.value = freq;
        f.Q.value = q;
        f.gain.value = gains[i] ?? 0;
        return f;
      });
      const panner = ctx.createStereoPanner();
      const compressor = ctx.createDynamicsCompressor();
      const makeup = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // source → preamp → f1 → … → fN → balance → compressor → makeup → out
      let node: AudioNode = source;
      node.connect(preampNode);
      node = preampNode;
      filters.forEach((f) => {
        node.connect(f);
        node = f;
      });
      node.connect(panner);
      panner.connect(compressor);
      compressor.connect(makeup);
      makeup.connect(ctx.destination);
      // The analyser is a tap, not a stage: it must not sit in the signal path
      // or it would be one more node to keep gain-staged.
      makeup.connect(analyser);

      preampRef.current = preampNode;
      filtersRef.current = filters;
      pannerRef.current = panner;
      compressorRef.current = compressor;
      makeupRef.current = makeup;
      analyserRef.current = analyser;
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
  }, [videoRef, gains, q]);

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

  // Effective preamp: the manual value, or the auto trim that keeps the
  // loudest boost from clipping.
  const effectivePreamp = useMemo(() => {
    if (!autoPreamp) return preamp;
    const loudest = eqEnabled ? Math.max(0, ...gains) : 0;
    return -loudest;
  }, [autoPreamp, preamp, gains, eqEnabled]);

  // Push the preamp trim.
  useEffect(() => {
    const node = preampRef.current;
    if (!node) return;
    node.gain.value = Math.pow(10, effectivePreamp / 20);
  }, [effectivePreamp]);

  // Push EQ gains and bandwidth.
  useEffect(() => {
    const filters = filtersRef.current;
    if (!filters.length) return;
    filters.forEach((f, i) => {
      // Bypassed EQ flattens every band rather than disconnecting the graph —
      // cheaper, and keeps the node chain intact.
      f.gain.value = eqEnabled ? gains[i] ?? 0 : 0;
      // Shelves ignore Q; setting it on them is harmless but pointless.
      if (f.type === 'peaking') f.Q.value = q;
    });
  }, [gains, eqEnabled, q]);

  // Push balance.
  useEffect(() => {
    const panner = pannerRef.current;
    if (!panner) return;
    panner.pan.value = Math.max(-1, Math.min(1, balance));
  }, [balance]);

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
      preampRef.current = null;
      filtersRef.current = [];
      pannerRef.current = null;
      compressorRef.current = null;
      makeupRef.current = null;
      analyserRef.current = null;
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
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;
      setGains(preset.gains);
      // Keep the macros in step so a switch to simple mode does not silently
      // discard the preset that was just chosen.
      setSimpleState(simpleFromGains(preset.gains));
    },
    [presets, setGains]
  );

  const setSimple = useCallback((key: keyof SimpleBands, v: number) => {
    const clamped = Math.max(-EQ_GAIN_LIMIT, Math.min(EQ_GAIN_LIMIT, v));
    setSimpleState((prev) => ({ ...prev, [key]: clamped }));
  }, []);

  const setMode = useCallback(
    (next: 'simple' | 'advanced') => {
      if (next === 'simple') {
        // Derive the macros from whatever the bands currently say, so the
        // switch never throws away the viewer's curve.
        setSimpleState((prev) => (gains === DEFAULT_GAINS ? prev : simpleFromGains(gains)));
      }
      setModeState(next);
    },
    [gains]
  );

  const reset = useCallback(() => {
    setGainsState(DEFAULT_GAINS);
    setSimpleState(FLAT_SIMPLE);
    setPreampState(0);
    setBalanceState(0);
  }, []);

  const saveCustomPreset = useCallback(
    (label: string) => {
      const name = label.trim();
      if (!name) return;
      setCustomPresets((prev) => {
        // Replace an existing entry of the same name rather than stacking
        // duplicates the viewer cannot tell apart.
        const id = `custom:${name.toLowerCase()}`;
        const next = [...prev.filter((p) => p.id !== id), { id, label: name, gains, custom: true }];
        try {
          window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
        } catch {
          // Storage is an optimisation only.
        }
        return next;
      });
    },
    [gains]
  );

  const deleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      } catch {
        // Storage is an optimisation only.
      }
      return next;
    });
  }, []);

  const readSpectrum = useCallback((target: Uint8Array) => {
    const analyser = analyserRef.current;
    if (!analyser) return false;
    analyser.getByteFrequencyData(target);
    return true;
  }, []);

  // A preset is "active" only while the gains still match it exactly.
  const activePreset =
    presets.find((p) => p.gains.every((g, i) => Math.abs(g - (gains[i] ?? 0)) < 0.01))?.id ?? null;

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
    reset,
    preamp: effectivePreamp,
    setPreamp: setPreampState,
    autoPreamp,
    setAutoPreamp: setAutoPreampState,
    q,
    setQ: setQState,
    balance,
    setBalance: setBalanceState,
    mode,
    setMode,
    simple,
    setSimple,
    maximizer,
    setMaximizer: setMaximizerState,
    maximizerEnabled,
    setMaximizerEnabled: setMaximizerEnabledState,
    reduction,
    presets,
    saveCustomPreset,
    deleteCustomPreset,
    readSpectrum,
  };
}
