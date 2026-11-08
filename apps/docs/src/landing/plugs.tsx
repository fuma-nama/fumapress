import { rr } from "./pen";

/* the plugs where the cord enters and leaves a figure */

export function PlugSvg({ flip }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 42"
      className="block h-10.5 w-6 overflow-visible"
      style={flip ? { transform: "scaleY(-1)" } : undefined}
      aria-hidden
    >
      {/* its flat shadow, at the angle of the cord's, so the cord's shadow runs into it */}
      <g transform={flip ? "translate(14 -8)" : "translate(14 8)"} filter="url(#w-flat)">
        <path
          d={`M9.5 0.5H14.5V6H16L17.5 15H17Q20 15 20 18V37Q20 40 17 40H7Q4 40 4 37V18Q4 15 7 15H6.5L8 6H9.5Z`}
          className="fill-w-shadow-glaze"
        />
      </g>
      <g filter="url(#w-wash)">
        <path d="M8 6H16L17.5 15H6.5Z" className="fill-w-indigo-wash" opacity={0.7} />
        <path d={rr(4, 15, 16, 25, 3)} className="fill-w-sheet" />
        <path d="M14 15H17Q20 15 20 18V37Q20 40 17 40H14Z" className="fill-w-deep" opacity={0.22} />
      </g>
      <g filter="url(#w-ink)">
        <path d="M9.5 0.5H14.5V6H9.5Z" className="fill-w-ink" />
        <path
          d="M10.5 1V5.5"
          className="stroke-w-gloss"
          strokeWidth={0.7}
          opacity={0.8}
          fill="none"
        />
        <path d="M8 6H16L17.5 15H6.5Z" className="stroke-w-ink" strokeWidth={1.1} fill="none" />
        <path
          d="M7.6 8.5H16.4M7.2 11H16.8M6.9 13.4H17.1"
          className="stroke-w-ink"
          strokeWidth={0.6}
          fill="none"
        />
        <path d={rr(4, 15, 16, 25, 3)} className="stroke-w-ink" strokeWidth={1.3} fill="none" />
        <path
          d="M7.5 21H12.5M7.5 24H12.5M7.5 27H12.5M7.5 30H12.5M7.5 33H12.5"
          className="stroke-w-ink-soft"
          strokeWidth={0.7}
          fill="none"
        />
        <path
          d="M5.8 17Q5.2 27 6 38"
          className="stroke-w-gloss"
          strokeWidth={0.9}
          opacity={0.85}
          fill="none"
        />
      </g>
      <circle cx={16} cy={36} r={1.2} className="fill-w-green" />
    </svg>
  );
}

/**
 * A plug on the edge of a figure. The cord of the page runs through its anchor.
 *
 * @param x - position on the edge, in percent
 * @param wander - where the cord drifts after leaving, as two fractions of the page width
 */
export function Jack({
  edge,
  x = 50,
  y,
  wander,
}: {
  edge: "top" | "bottom";
  x?: number;
  /**
   * plug into a device inside the figure instead of the edge of a sheet: the point on the device's top or bottom
   * outline, in percent of the figure's height
   */
  y?: number;
  wander?: [number, number];
}) {
  const top = edge === "top";
  const device = y !== undefined;
  return (
    <div
      // on phones, the cord runs down the left gutter: a plug on a sheet moves near the left edge, a plug on a device
      // stays where the device takes it
      className={`pointer-events-none absolute z-1 flex flex-col items-center${device ? "" : " max-xl:left-1/12!"}`}
      style={{
        left: `${x}%`,
        top: device ? `${y}%` : top ? 0 : "100%",
        transform: `translate(-50%, ${top ? "-100%" : "0"})`,
      }}
      aria-hidden
    >
      {top && <span data-cord="in" className="size-px" />}
      <PlugSvg flip={!top} />
      {!top && <span data-cord="out" data-wander={wander?.join(",")} className="size-px" />}
    </div>
  );
}
