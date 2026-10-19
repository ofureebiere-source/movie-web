import { useEffect, useRef, useState } from 'react';

/**
 * Horizontal-rail behaviour shared by every `DiscoveryRail`, exactly as the
 * reference implements it (`MediaCard` chunk's `useHorizontalScroll`):
 *
 *  - the wheel scrolls the rail sideways when the gesture is more horizontal
 *    than vertical, and the rail actually overflows;
 *  - the track is otherwise left to native scrolling.
 *
 * The returned ref goes on the scroll container.
 */
export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>(
  externalRef?: React.RefObject<T>,
  options: { speedMultiplier?: number; disabled?: boolean } = {}
): React.RefObject<T> {
  const internalRef = useRef<T>(null);
  const ref = externalRef || internalRef;
  const { speedMultiplier = 1, disabled = false } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (element.scrollWidth <= element.clientWidth) return;

      let delta = event.deltaY * speedMultiplier;
      if (event.deltaMode === 1) delta *= 33; // lines
      else if (event.deltaMode === 2) delta *= 100; // pages

      const atStart = element.scrollLeft <= 0 && delta < 0;
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 && delta > 0;
      if (atStart || atEnd) return;

      event.preventDefault();
      element.scrollLeft += delta;
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [ref, disabled, speedMultiplier]);

  return ref;
}

/**
 * Arrow-button state for a rail: whether the track can scroll further left or
 * right, recomputed on scroll and resize.
 */
export function useRailScrollState<T extends HTMLElement = HTMLDivElement>(
  ref: React.RefObject<T>,
  dependency: unknown
): { canScrollLeft: boolean; canScrollRight: boolean } {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      const left = scrollLeft > 10;
      const right = scrollLeft < scrollWidth - clientWidth - 10;
      setCanScrollLeft((prev) => (prev === left ? prev : left));
      setCanScrollRight((prev) => (prev === right ? prev : right));
    };

    measure();
    let frame = 0;
    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      element.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref, dependency]);

  return { canScrollLeft, canScrollRight };
}

/** Scroll a rail by 75% of its visible width. */
export function scrollRailBy<T extends HTMLElement>(ref: React.RefObject<T | null>, direction: 'left' | 'right'): void {
  const element = ref.current;
  if (!element) return;
  const amount = element.clientWidth * 0.75;
  element.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}
