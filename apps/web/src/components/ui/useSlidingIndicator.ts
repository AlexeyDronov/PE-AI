"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

export type IndicatorRect = { left: number; width: number };

/** Measures the element marked data-active="true" inside the container, for a sliding thumb or underline. */
export function useSlidingIndicator(ref: RefObject<HTMLElement | null>, activeKey: string): IndicatorRect | null {
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const measure = () => {
      const el = container.querySelector<HTMLElement>('[data-active="true"]');
      setRect(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [ref, activeKey]);

  return rect;
}
