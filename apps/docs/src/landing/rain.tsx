import type { CSSProperties } from "react";
import { cn } from "../cn";

/**
 * Rain behind a window's glass, and drops running down it.
 *
 * Each pane gets three depths of streaks. A depth is a tile of vertical streaks repeated over a rotated layer, which
 * moves down by exactly one tile and starts over, so the loop has no seam; it runs as a transform, on the GPU. See
 * `.w-rain-*` in washi.css.
 */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** the height of a tile in CSS pixels, how far a layer moves in one loop */
const TILE = 180;

/** the lean of the rain: one angle for every depth, as rain falls in still air */
const ANGLE = 9;

function seeded(seed: number) {
  let s = seed * 7919 + 17;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const depths = [
  // far: many short, faint streaks, falling slowly
  { n: 34, len: [7, 13], width: 0.6, alpha: 0.32, duration: 1.15, seed: 3 },
  // middle
  { n: 18, len: [14, 24], width: 0.8, alpha: 0.42, duration: 0.72, seed: 7 },
  // near: few long streaks, falling fast
  { n: 7, len: [26, 40], width: 1.1, alpha: 0.5, duration: 0.46, seed: 11 },
];

/** a tile of streaks as a data URL; streaks wrap around the tile's bottom edge so it repeats without a seam */
function tile({ n, len, width, alpha, seed }: (typeof depths)[number]) {
  const rand = seeded(seed);
  const w = 120;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = (rand() * w).toFixed(1);
    const y = rand() * TILE;
    const l = len[0]! + rand() * (len[1]! - len[0]!);
    const o = (alpha * (0.55 + rand() * 0.45)).toFixed(2);
    for (const dy of [0, -TILE]) {
      const y0 = y + dy;
      if (y0 + l < 0) continue;
      parts.push(`<path d='M${x} ${y0.toFixed(1)}v${l.toFixed(1)}' stroke-opacity='${o}'/>`);
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${TILE}' fill='none' stroke='white' stroke-width='${width}' stroke-linecap='round'>${parts.join("")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const tiles = depths.map(tile);

/** drops on the glass: where they cling, as fractions of the pane, and their own timing */
const drops = [
  { pane: 1, x: 0.18, y: 0.12, size: 5, duration: 11, delay: -2 },
  { pane: 1, x: 0.63, y: 0.3, size: 4, duration: 14, delay: -9 },
  { pane: 3, x: 0.35, y: 0.08, size: 6, duration: 12.5, delay: -5 },
  { pane: 3, x: 0.82, y: 0.22, size: 4, duration: 16, delay: -12 },
  { pane: 0, x: 0.45, y: 0.2, size: 4, duration: 18, delay: -7 },
];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function Rain({
  glass,
  panes,
  viewBox,
  className,
}: {
  /** the whole glass: the rain falls behind it in one piece, the frame in front hides where the panes meet */
  glass: Rect;
  /** the panes, which drops run down until they slip under a rail */
  panes: readonly Rect[];
  viewBox: { w: number; h: number };
  className?: string;
}) {
  const box = (r: Rect): CSSProperties => ({
    left: pct(r.x, viewBox.w),
    top: pct(r.y, viewBox.h),
    width: pct(r.w, viewBox.w),
    height: pct(r.h, viewBox.h),
  });
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <div className="absolute overflow-hidden" style={box(glass)}>
        {tiles.map((image, d) => (
          <div key={d} className="absolute -inset-x-1/3 -inset-y-2/5">
            <div
              className="w-rain-fall"
              style={
                {
                  backgroundImage: image,
                  "--tile": `${TILE}px`,
                  "--angle": `${ANGLE}deg`,
                  animationDuration: `${depths[d]!.duration}s`,
                  animationDelay: `${-((d * 0.37) % 1) * depths[d]!.duration}s`,
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
      {panes.map((p, i) => (
        <div key={i} className="absolute overflow-hidden" style={box(p)}>
          {drops
            .filter((drop) => drop.pane === i)
            .map((drop, k) => (
              <div
                key={k}
                className="w-drop-track"
                style={{
                  left: `${drop.x * 100}%`,
                  animationDuration: `${drop.duration}s`,
                  animationDelay: `${drop.delay}s`,
                }}
              >
                <span
                  className="w-drop"
                  style={{ top: `${drop.y * 100}%`, width: drop.size, height: drop.size * 1.25 }}
                />
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
