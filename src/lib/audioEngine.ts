import type { AudioBoost } from '@/lib/playerPreferences';

/**
 * The Web Audio graph behind the player's audio boost and equaliser.
 *
 * frameXTV.xyz builds one graph per video element and keeps it in a WeakMap:
 *
 *   MediaElementSource -> BiquadFilter(peaking 2500 Hz, Q 1.2)
 *                      -> Gain -> DynamicsCompressor -> destination
 *
 * `audioBoost` only ever changes the gain, the filter gain and the compressor
 * threshold/ratio, which is why its 150/200/300 steps sound like loudness
 * rather than tone. Our equaliser is an addition on top of the same graph: a
 * ten-band peaking bank inserted between the boost gain and the compressor,
 * plus a pre-amp so a boosted curve does not clip.
 *
 * The graph is created lazily on the first non-default boost or EQ change.
 * `createMediaElementSource` may only be called once per element and it
 * re-routes the element's output permanently, so a plain "off" boost with a
 * flat EQ deliberately leaves the element alone.
 */

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export interface EqualizerSettings {
  enabled: boolean;
  /** Gain in dB per band, same order as `EQ_FREQUENCIES`. */
  gains: number[];
  /** Output trim in dB, -12..+12. */
  preamp: number;
}

export const EQ_BANDS = EQ_FREQUENCIES;

export const EQ_PRESETS: Array<{ id: string; label: string; gains: number[] }> = [
  { id: 'flat', label: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass', label: 'Bass boost', gains: [7, 6, 4.5, 2.5, 0.5, 0, 0, 0, 0, 0] },
  { id: 'treble', label: 'Treble boost', gains: [0, 0, 0, 0, 0, 1, 2.5, 4.5, 6, 7] },
  { id: 'vocal', label: 'Vocal', gains: [-2, -1.5, -0.5, 1.5, 3.5, 4.5, 3.5, 1.5, 0, -1] },
  { id: 'loudness', label: 'Loudness', gains: [6, 5, 1.5, -1, -2.5, -1.5, 1.5, 4, 5.5, 5] },
  { id: 'cinema', label: 'Cinema', gains: [4, 3, 1, -0.5, -1, 0.5, 2, 3, 3.5, 2.5] },
  { id: 'podcast', label: 'Podcast', gains: [-6, -4, -1.5, 2, 4, 4.5, 3, 1, -1, -2.5] },
];

export const EQ_DEFAULT: EqualizerSettings = {
  enabled: false,
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
};

interface BoostGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  /** The reference's 2500 Hz peaking filter. */
  filter: BiquadFilterNode;
  gain: GainNode;
  eqGains: BiquadFilterNode[];
  preamp: GainNode;
  compressor: DynamicsCompressorNode;
  activeBoost: AudioBoost;
  eq: EqualizerSettings;
}

const graphs = new WeakMap<HTMLMediaElement, BoostGraph>();

/** Ramp a param, falling back to a direct assignment on older engines. */
function ramp(param: AudioParam, value: number, ctx: AudioContext): void {
  try {
    if (typeof param.setTargetAtTime === 'function') {
      param.setTargetAtTime(value, ctx.currentTime, 0.03);
    } else if (typeof param.setValueAtTime === 'function') {
      param.setValueAtTime(value, ctx.currentTime);
    } else {
      param.value = value;
    }
  } catch {
    param.value = value;
  }
}

/** Whether the element needs a graph at all for the given settings. */
export function needsGraph(boost: AudioBoost, eq: EqualizerSettings): boolean {
  if (boost !== 'off') return true;
  if (eq.enabled && (eq.preamp !== 0 || eq.gains.some((gain) => gain !== 0))) return true;
  return false;
}

function buildGraph(element: HTMLMediaElement): BoostGraph | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    console.warn('[AudioBooster] Web Audio API is not supported in this browser.');
    return null;
  }

  try {
    const ctx = new Ctor();
    const source = ctx.createMediaElementSource(element);

    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 2500;
    filter.Q.value = 1.2;
    filter.gain.value = 0;

    const gain = ctx.createGain();
    gain.gain.value = 1;

    const eqGains = EQ_FREQUENCIES.map((frequency) => {
      const node = ctx.createBiquadFilter();
      node.type = 'peaking';
      node.frequency.value = frequency;
      node.Q.value = 1;
      node.gain.value = 0;
      return node;
    });

    const preamp = ctx.createGain();
    preamp.gain.value = 1;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = 0;
    compressor.knee.value = 8;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    let tail: AudioNode = source;
    tail.connect(filter);
    tail = filter;
    tail.connect(gain);
    tail = gain;
    for (const node of eqGains) {
      tail.connect(node);
      tail = node;
    }
    tail.connect(preamp);
    tail = preamp;
    tail.connect(compressor);
    compressor.connect(ctx.destination);

    const graph: BoostGraph = {
      ctx,
      source,
      filter,
      gain,
      eqGains,
      preamp,
      compressor,
      activeBoost: 'off',
      eq: { ...EQ_DEFAULT },
    };
    graphs.set(element, graph);
    return graph;
  } catch (error) {
    console.warn('[AudioBooster] Failed to initialize Web Audio boost graph:', error);
    return null;
  }
}

/** Resume a context the browser suspended before the first gesture. */
export function resumeAudio(element: HTMLMediaElement | null): void {
  if (!element) return;
  const graph = graphs.get(element);
  if (graph && graph.ctx.state === 'suspended') void graph.ctx.resume().catch(() => undefined);
}

function applyEq(graph: BoostGraph, eq: EqualizerSettings): void {
  const { ctx, eqGains, preamp } = graph;
  eqGains.forEach((node, index) => {
    const value = eq.enabled ? (eq.gains[index] ?? 0) : 0;
    ramp(node.gain, value, ctx);
  });
  const trim = eq.enabled ? eq.preamp : 0;
  ramp(preamp.gain, Math.pow(10, trim / 20), ctx);
}

function applyBoost(graph: BoostGraph, boost: AudioBoost): void {
  const { ctx, gain, filter, compressor } = graph;
  switch (boost) {
    case '150':
      ramp(gain.gain, 1.5, ctx);
      ramp(filter.gain, 0, ctx);
      ramp(compressor.threshold, -10, ctx);
      ramp(compressor.ratio, 10, ctx);
      break;
    case '200':
      ramp(gain.gain, 2, ctx);
      ramp(filter.gain, 0, ctx);
      ramp(compressor.threshold, -12, ctx);
      ramp(compressor.ratio, 12, ctx);
      break;
    case '300':
      ramp(gain.gain, 3, ctx);
      ramp(filter.gain, 0, ctx);
      ramp(compressor.threshold, -14, ctx);
      ramp(compressor.ratio, 14, ctx);
      break;
    case 'dialogue':
      ramp(gain.gain, 1.6, ctx);
      ramp(filter.gain, 6, ctx);
      ramp(compressor.threshold, -12, ctx);
      ramp(compressor.ratio, 6, ctx);
      break;
    default:
      ramp(gain.gain, 1, ctx);
      ramp(filter.gain, 0, ctx);
      ramp(compressor.threshold, 0, ctx);
      ramp(compressor.ratio, 12, ctx);
      break;
  }
}

/**
 * Apply the boost and equaliser to an element, building the graph on demand.
 *
 * A no-op — with the element left completely untouched — when both are at
 * their defaults, which is what keeps plain playback bit-identical.
 */
export function applyAudioProcessing(
  element: HTMLMediaElement | null,
  boost: AudioBoost,
  eq: EqualizerSettings
): void {
  if (!element) return;
  if (!needsGraph(boost, eq) && !graphs.has(element)) return;

  const graph = graphs.get(element) ?? buildGraph(element);
  if (!graph) return;

  if (graph.ctx.state === 'suspended') void graph.ctx.resume().catch(() => undefined);

  applyBoost(graph, boost);
  applyEq(graph, eq);
  graph.activeBoost = boost;
  graph.eq = { ...eq, gains: [...eq.gains] };
}
