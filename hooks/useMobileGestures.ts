'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerActions, PlayerState } from './usePlayerState';

/**
 * Gestures over the player surface:
 *   - Horizontal drag → scrub, with a time HUD ("+15s")
 *   - Vertical drag on the RIGHT half → volume, with a level meter
 *   - Vertical drag on the LEFT half → brightness, with a level meter
 *     (a CSS filter — real device brightness is not web-accessible)
 *   - Pinch-out → fullscreen
 *
 * The two vertical gestures follow the convention every phone video player
 * uses: the side you touch decides what you are changing, and dragging up
 * increases it. The HUD reports which side and by how much, so the gesture is
 * legible the first time someone uses it rather than something to be learned.
 *
 * Touch is the trigger. A mouse drag would fight the click-to-toggle and
 * double-click-to-fullscreen handlers on the same surface, so pointer input
 * from a mouse or pen is left to those.
 *
 * Activation thresholds avoid hijacking the user's intent on small movements.
 * Gestures are suppressed while `isLocked` is true.
 */

const ACTIVATION_PX = 24;          // distance before a gesture commits to a direction
const SECONDS_PER_PX_AT_REF_W = 0.5; // ~0.5s per px at a 400px-wide screen
const VOLUME_PER_PX_AT_REF_H = 0.005;
const BRIGHTNESS_PER_PX_AT_REF_H = 0.005;
const BRIGHTNESS_MIN = 0.3;
const BRIGHTNESS_MAX = 1.5;
const PINCH_DELTA_PX = 60;        // distance between fingers must grow by this to trigger fullscreen

type Mode = null | 'scrub' | 'volume' | 'brightness';

export interface UseMobileGesturesOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: PlayerState;
  actions: PlayerActions;
  enabled: boolean;
}

export interface UseMobileGesturesReturn {
  /** CSS filter brightness multiplier — apply to the <video> element. */
  brightness: number;
  /** Heads-up display state. Null when no gesture is active. */
  hud:
    | null
    | { kind: 'scrub'; targetTime: number; delta: number }
    | { kind: 'volume'; value: number }
    | { kind: 'brightness'; value: number };
  /** True while a vertical brightness/volume drag is in progress. */
  adjusting: boolean;
}

interface Pointer {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  startTime: number;
}

export function useMobileGestures({
  containerRef,
  state,
  actions,
  enabled,
}: UseMobileGesturesOptions): UseMobileGesturesReturn {
  const [brightness, setBrightness] = useState(1);
  const [hud, setHud] = useState<UseMobileGesturesReturn['hud']>(null);
  const [adjusting, setAdjusting] = useState(false);
  const pointersRef = useRef<Map<number, Pointer>>(new Map());
  const modeRef = useRef<Mode>(null);
  const startStateRef = useRef<{
    time: number;
    volume: number;
    brightness: number;
    pinchDistance: number;
  } | null>(null);
  const hudHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const brightnessRef = useRef(brightness);
  brightnessRef.current = brightness;

  const scheduleHudHide = useCallback(() => {
    if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
    hudHideTimer.current = setTimeout(() => setHud(null), 600);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const dist = (a: Pointer, b: Pointer) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const onPointerDown = (e: PointerEvent) => {
      // Only respond to touch — desktop mouse / pen behaviors are owned by
      // VideoControlsOverlay's tap handler.
      if (e.pointerType !== 'touch') return;
      pointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        startTime: performance.now(),
      });
      // Seed start-state once on first finger down.
      if (pointersRef.current.size === 1) {
        startStateRef.current = {
          time: stateRef.current.currentTime,
          volume: stateRef.current.volume,
          brightness: brightnessRef.current,
          pinchDistance: 0,
        };
        modeRef.current = null;
      }
      if (pointersRef.current.size === 2 && startStateRef.current) {
        const ps = Array.from(pointersRef.current.values());
        startStateRef.current.pinchDistance = dist(ps[0], ps[1]);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const p = pointersRef.current.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      const start = startStateRef.current;
      if (!start) return;

      // Pinch detection — two fingers, distance growing.
      if (pointersRef.current.size === 2 && start.pinchDistance > 0) {
        const ps = Array.from(pointersRef.current.values());
        const d = dist(ps[0], ps[1]);
        if (d - start.pinchDistance > PINCH_DELTA_PX) {
          actions.toggleFullscreen(containerRef.current);
          startStateRef.current = null;
          pointersRef.current.clear();
          modeRef.current = null;
        }
        return;
      }

      // Single finger gestures.
      if (pointersRef.current.size !== 1) return;

      const dx = p.x - p.startX;
      const dy = p.y - p.startY;

      // Commit to a direction once movement crosses threshold.
      if (modeRef.current === null) {
        if (Math.abs(dx) < ACTIVATION_PX && Math.abs(dy) < ACTIVATION_PX) return;
        const rect = containerRef.current!.getBoundingClientRect();
        if (Math.abs(dx) > Math.abs(dy)) {
          modeRef.current = 'scrub';
        } else {
          modeRef.current = p.startX - rect.left > rect.width / 2 ? 'volume' : 'brightness';
        }
      }

      const rect = containerRef.current!.getBoundingClientRect();
      const widthScale = rect.width / 400;
      const heightScale = rect.height / 300;

      if (modeRef.current === 'scrub') {
        const delta = dx * SECONDS_PER_PX_AT_REF_W * widthScale;
        const target = Math.max(
          0,
          Math.min((stateRef.current.duration || 0) - 0.1, start.time + delta)
        );
        setHud({ kind: 'scrub', targetTime: target, delta });
      } else if (modeRef.current === 'volume') {
        const next = Math.max(
          0,
          Math.min(1, start.volume - dy * VOLUME_PER_PX_AT_REF_H * heightScale)
        );
        actions.setVolume(next);
        setAdjusting(true);
        setHud({ kind: 'volume', value: next });
      } else if (modeRef.current === 'brightness') {
        const next = Math.max(
          BRIGHTNESS_MIN,
          Math.min(BRIGHTNESS_MAX, start.brightness - dy * BRIGHTNESS_PER_PX_AT_REF_H * heightScale)
        );
        setBrightness(next);
        setAdjusting(true);
        setHud({ kind: 'brightness', value: next });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const p = pointersRef.current.get(e.pointerId);
      pointersRef.current.delete(e.pointerId);
      if (!p) return;

      // Commit scrub on release.
      if (modeRef.current === 'scrub' && hud?.kind === 'scrub') {
        actions.seek(hud.targetTime);
      }

      if (pointersRef.current.size === 0) {
        modeRef.current = null;
        startStateRef.current = null;
        setAdjusting(false);
        scheduleHudHide();
      }
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [containerRef, enabled, actions, hud, scheduleHudHide]);

  return { brightness, hud, adjusting };
}
