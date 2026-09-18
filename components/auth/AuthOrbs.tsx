"use client";

import { useEffect, useRef } from "react";

const REPEL_RADIUS = 200;
const MAX_DISPLACEMENT = 46;

/**
 * The two decorative rings behind the auth card. They drift on their own
 * (the `auth-orb-a`/`auth-orb-b` keyframes in globals.css, on the inner
 * div), and on desktop they also dodge the real cursor — the custom cursor
 * effectively "pushes" them as it passes near.
 *
 * Position is split across two elements on purpose: this wrapper gets the
 * JS-driven dodge offset via inline `transform`, the inner div keeps the
 * CSS keyframe drift. One element can't cleanly own both — a CSS animation
 * on `transform` would just overwrite whatever this component sets inline.
 *
 * Skipped entirely on touch (nothing to dodge) and under
 * prefers-reduced-motion, same as the custom cursor.
 */
export function AuthOrbs() {
  const wrapARef = useRef<HTMLDivElement>(null);
  const wrapBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const wraps = [wrapARef.current, wrapBRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    );
    if (wraps.length === 0) return;

    function dodge(el: HTMLDivElement, x: number, y: number) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist >= REPEL_RADIUS) {
        el.style.transform = "translate(0px, 0px)";
        return;
      }
      const strength = (1 - dist / REPEL_RADIUS) * MAX_DISPLACEMENT;
      el.style.transform = `translate(${(dx / dist) * strength}px, ${(dy / dist) * strength}px)`;
    }

    function onMove(event: PointerEvent) {
      for (const el of wraps) dodge(el, event.clientX, event.clientY);
    }
    function onLeave() {
      for (const el of wraps) el.style.transform = "translate(0px, 0px)";
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <>
      <div
        ref={wrapARef}
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-72 transition-transform duration-300 ease-out"
      >
        <div
          className="auth-orb-a size-full rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--color-accent) 35%, transparent), transparent)",
          }}
        />
      </div>
      <div
        ref={wrapBRef}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-28 size-80 transition-transform duration-300 ease-out"
      >
        <div
          className="auth-orb-b size-full rounded-full border"
          style={{ borderColor: "color-mix(in oklch, var(--color-accent) 30%, transparent)" }}
        />
      </div>
    </>
  );
}
