"use client";

import { useEffect, useRef } from "react";

/**
 * Replaces the native pointer with a small circle that breathes gently and
 * grows over clickable elements. Only turns on once JS confirms a real mouse
 * (not touch) and no reduced-motion preference — otherwise the native cursor
 * is left exactly alone, as a progressive-enhancement fallback.
 */
export function CustomCursor() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const box = boxRef.current;
    if (!box) return;

    document.documentElement.classList.add("has-custom-cursor");

    function place(x: number, y: number) {
      const size = box!.getBoundingClientRect().width;
      box!.style.left = `${x - size / 2}px`;
      box!.style.top = `${y - size / 2}px`;
    }

    function onMove(event: PointerEvent) {
      place(event.clientX, event.clientY);
      box!.classList.add("is-visible");
      const interactive = (event.target as HTMLElement)?.closest?.(
        "a, button, input, textarea, select, [role='button'], [contenteditable]",
      );
      box!.classList.toggle("is-hover", !!interactive);
    }
    function onDown() {
      box!.classList.add("is-active");
    }
    function onUp() {
      box!.classList.remove("is-active");
    }
    function onLeaveWindow() {
      box!.classList.remove("is-visible");
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("mouseleave", onLeaveWindow);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeaveWindow);
    };
  }, []);

  return (
    <div ref={boxRef} className="custom-cursor" aria-hidden="true">
      <span className="custom-cursor__dot" />
    </div>
  );
}
