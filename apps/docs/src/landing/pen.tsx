import {
  cloneElement,
  createElement,
  Fragment,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Parts } from "./parts.client";

/**
 * The pen and brushes of the landing page drawings.
 *
 * Lines go through `#w-ink`, which wobbles them like a pen. Fills go through `#w-wash`, which gives
 * them the uneven edge, darker rim and grain of watercolor. Colors are classes of `washi.css`.
 */

export function InkDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="w-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" />
          <feDisplacementMap
            in="SourceGraphic"
            scale="1.1"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="w-wash" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            seed="9"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feMorphology in="d" operator="erode" radius="2.5" result="e" />
          <feComposite in="d" in2="e" operator="out" result="rim" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="2"
            seed="2"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.55 0 0 0 1.12"
            result="ga"
          />
          <feComposite in="d" in2="ga" operator="in" result="grain" />
          <feMerge>
            <feMergeNode in="grain" />
            <feMergeNode in="rim" />
          </feMerge>
        </filter>
        <filter id="w-wash-dense" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            seed="12"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="3"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.18 0 0 0 1.06"
            result="ga"
          />
          <feComposite in="d" in2="ga" operator="in" />
        </filter>
        {/* the dry, slightly broken edge of paint laid with a brush */}
        <filter id="w-paint" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="2"
            seed="21"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.1 0.35"
            numOctaves="2"
            seed="6"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.9 0 0 0 1.38"
            result="ga"
          />
          <feComposite in="d" in2="ga" operator="in" />
        </filter>
        <filter id="w-flat" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves="2"
            seed="5"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.5"
            numOctaves="2"
            seed="8"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.7 0 0 0 1.25"
            result="ga"
          />
          <feComposite in="d" in2="ga" operator="in" />
        </filter>
        {/* air between the eye and a far layer: softened, with the grain of the paint kept */}
        <filter id="w-haze" x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8 0.3"
            numOctaves="2"
            seed="17"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.5 0 0 0 1.2"
            result="ga"
          />
          <feComposite in="b" in2="ga" operator="in" />
        </filter>
        <filter id="w-haze-far" x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.6 0.25"
            numOctaves="2"
            seed="19"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.4 0 0 0 1.15"
            result="ga"
          />
          <feComposite in="b" in2="ga" operator="in" />
        </filter>
        {/* a light or a mist, spread wide and soft */}
        <filter id="w-bloom" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" />
        </filter>
      </defs>
    </svg>
  );
}

/* drawing helpers */

export function rr(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

/** the four edges of a box, each running past the corners like a quick pen sketch */
export function box(x: number, y: number, w: number, h: number, o = 5) {
  return `M${x - o} ${y + 0.6}L${x + w + o} ${y - 0.4}M${x + w - 0.5} ${y - o}L${x + w + 0.4} ${y + h + o}M${x + w + o} ${y + h + 0.5}L${x - o} ${y + h - 0.3}M${x + 0.4} ${y + h + o}L${x - 0.3} ${y - o}`;
}

export function gear(cx: number, cy: number, r: number, teeth: number, h = 3) {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let t = 0; t < teeth; t++) {
    const a = t * step;
    for (const [da, rad] of [
      [-0.32, r],
      [-0.18, r + h],
      [0.18, r + h],
      [0.32, r],
    ] as const) {
      const ang = a + da * step;
      pts.push(`${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`);
    }
  }
  return `M${pts.join("L")}Z`;
}

export function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

export interface LineProps {
  d: string;
  w?: number;
  c?: string;
  o?: number;
}

export function Line({ d, w = 1.4, c = "w-s-ink", o }: LineProps) {
  return (
    <path
      d={d}
      className={c}
      strokeWidth={w}
      opacity={o}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** a line drawn twice, the second pass a little off */
export function Sketch({ d, w = 1.4, c = "w-s-ink", o }: LineProps) {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  const dx = ((h % 100) / 100 - 0.5) * 1.1;
  const dy = (((h >> 8) % 100) / 100 - 0.5) * 1.1;
  return (
    <>
      <Line d={d} w={w} c={c} o={o} />
      <g transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`}>
        <Line d={d} w={w * 0.5} c={c} o={(o ?? 1) * 0.55} />
      </g>
    </>
  );
}

export function Fill({ d, c, o }: { d: string; c: string; o?: number }) {
  return <path d={d} className={c} opacity={o} />;
}

/** glyphs set one under another, so the vertical type does not depend on SVG writing modes */
export function VerticalText({
  x,
  y,
  glyphs,
  size,
  gap,
  className,
  style,
}: {
  x: number;
  y: number;
  glyphs: string[];
  size: number;
  gap: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <g className={className} style={style}>
      {glyphs.map((g, i) => (
        <text
          key={i}
          x={x}
          y={y + i * (size + gap)}
          fontSize={size}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {g}
        </text>
      ))}
    </g>
  );
}

/* the brush: painted strokes that taper and swell, instead of even pen lines */

export type Pt = [number, number];

/** points along a path of absolute M, L, H, V, Q, C and Z commands */
function ptsOfPath(d: string, step = 5): Pt[] {
  const tokens = d.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Pt[] = [];
  let i = 0;
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let cmd = "M";
  const num = () => Number(tokens[i++]);
  const line = (to: Pt) => {
    const n = Math.max(1, Math.ceil(Math.hypot(to[0] - cur[0], to[1] - cur[1]) / step));
    for (let k = 1; k <= n; k++)
      out.push([cur[0] + ((to[0] - cur[0]) * k) / n, cur[1] + ((to[1] - cur[1]) * k) / n]);
    cur = to;
  };
  const bezier = (c1: Pt, c2: Pt, to: Pt) => {
    const n = Math.max(
      2,
      Math.ceil(
        (Math.hypot(c1[0] - cur[0], c1[1] - cur[1]) +
          Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) +
          Math.hypot(to[0] - c2[0], to[1] - c2[1])) /
          step,
      ),
    );
    const p0 = cur;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1],
      ]);
    }
    cur = to;
  };
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[A-Za-z]/.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === "Z") {
        line(start);
        continue;
      }
    }
    switch (cmd) {
      case "M":
        cur = [num(), num()];
        start = cur;
        out.push(cur);
        cmd = "L";
        break;
      case "L":
        line([num(), num()]);
        break;
      case "H":
        line([num(), cur[1]]);
        break;
      case "V":
        line([cur[0], num()]);
        break;
      case "Q": {
        const q: Pt = [num(), num()];
        const to: Pt = [num(), num()];
        bezier(
          [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])],
          [to[0] + (2 / 3) * (q[0] - to[0]), to[1] + (2 / 3) * (q[1] - to[1])],
          to,
        );
        break;
      }
      case "C":
        bezier([num(), num()], [num(), num()], [num(), num()]);
        break;
      default:
        i++;
    }
  }
  return out;
}

export function ptsOfCircle(cx: number, cy: number, r: number, from = 0, to = Math.PI * 2): Pt[] {
  const n = Math.max(12, Math.ceil((Math.abs(to - from) * r) / 5));
  return Array.from({ length: n + 1 }, (_, k): Pt => {
    const a = from + ((to - from) * k) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function seeded(seed: number) {
  let s = Math.floor(seed * 9973) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * The outline of one brush stroke along the points: it tapers at both ends and its width swells
 * and thins like a loaded brush.
 */
function strokeOutline(
  pts: Pt[],
  width: number,
  {
    seed = 1,
    taper = [0.18, 0.3],
    pressure = 0.28,
  }: { seed?: number; taper?: [number, number]; pressure?: number } = {},
): string {
  if (pts.length < 2) return "";
  const rand = seeded(seed);
  const f1 = 2 + rand() * 3;
  const f2 = 7 + rand() * 6;
  const ph1 = rand() * 6.28;
  const ph2 = rand() * 6.28;
  const lens = [0];
  for (let i = 1; i < pts.length; i++)
    lens.push(lens[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = lens[lens.length - 1] || 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const t = lens[i]! / total;
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const ease = (x: number) => x * x * (3 - 2 * x);
    const tIn = taper[0] > 0 ? Math.min(1, t / taper[0]) : 1;
    const tOut = taper[1] > 0 ? Math.min(1, (1 - t) / taper[1]) : 1;
    const shape = 0.12 + 0.88 * ease(Math.min(tIn, tOut));
    const swell =
      1 + pressure * (0.65 * Math.sin(t * f1 * 6.28 + ph1) + 0.35 * Math.sin(t * f2 * 6.28 + ph2));
    const h = (width * shape * swell) / 2;
    const p = pts[i]!;
    left.push([p[0] + nx * h, p[1] + ny * h]);
    right.push([p[0] - nx * h, p[1] - ny * h]);
  }
  return compactPolygon([...left, ...right.reverse()]);
}

/** a closed polygon as path data: relative moves to one decimal, so a painting weighs a fraction of absolute ones */
function compactPolygon(pts: Pt[]): string {
  const r = (v: number) => Math.round(v * 10) / 10;
  const first = pts[0]!;
  let x = r(first[0]);
  let y = r(first[1]);
  let d = `M${x} ${y}l`;
  for (let i = 1; i < pts.length; i++) {
    const nx = r(pts[i]![0]);
    const ny = r(pts[i]![1]);
    const dx = r(nx - x);
    const dy = r(ny - y);
    if (dx === 0 && dy === 0) continue;
    d += `${i > 1 && dx >= 0 ? " " : ""}${dx}${dy >= 0 ? " " : ""}${dy}`;
    x = nx;
    y = ny;
  }
  return `${d}z`;
}

/** slices of a closed loop of points, so a loop is painted as overlapping strokes */
function loopSlices(pts: Pt[], strokes: number, seed: number): Pt[][] {
  const rand = seeded(seed + 7);
  const n = pts.length - 1;
  const offset = Math.floor(rand() * n);
  const len = Math.ceil(n / strokes);
  return Array.from({ length: strokes }, (_, k) => {
    const from = offset + k * len - Math.floor(len * 0.12);
    const to = offset + (k + 1) * len + Math.floor(len * 0.1);
    return Array.from({ length: to - from + 1 }, (_, j) => pts[(((from + j) % n) + n) % n]!);
  });
}

interface BrushProps {
  /** a path of absolute commands, or points */
  d?: string;
  pts?: Pt[];
  w?: number;
  /** a fill class of washi.css, e.g. `w-f-ink` */
  c?: string;
  o?: number;
  seed?: number;
  /** paint a closed shape as this many overlapping strokes */
  loop?: number;
  taper?: [number, number];
  pressure?: number;
}

/** a painted stroke: put it in `<g filter="url(#w-paint)">` for the dry edge of the paint */
export function Brush({
  d,
  pts,
  w = 2,
  c = "w-f-ink",
  o,
  seed,
  loop,
  taper,
  pressure,
}: BrushProps) {
  const points = pts ?? (d ? ptsOfPath(d) : []);
  const s =
    seed ?? (points.length ? points[0]![0] * 0.37 + points[0]![1] * 0.61 + points.length : 1);
  const parts = loop ? loopSlices(points, loop, s) : [points];
  return (
    <>
      {parts.map((p, k) => (
        <path
          key={k}
          d={strokeOutline(p, w, { seed: s + k * 3.1, taper, pressure })}
          className={c}
          opacity={o}
        />
      ))}
    </>
  );
}

/* cast shadows */

/** the convex hull of points */
function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0)
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/**
 * The shadow a solid object casts on the page, lit from the top left: everything its outline sweeps through as the
 * light pushes it down and right by `dx`, `dy`. It stays joined to the object, leaving it at a diagonal from the
 * corner facing the light and meeting it again at the opposite corner, as in the reference, instead of a copy set
 * behind. The farther the object stands off the page, the longer `dx`, `dy`. For convex outlines.
 */
export function cast(outline: string, dx: number, dy: number): string {
  const pts = ptsOfPath(outline, 3);
  const out = hull([...pts, ...pts.map(([x, y]) => [x + dx, y + dy] as Pt)]);
  return `M${out.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

/* the two layers of a painted figure */

/** classes of the parts that keep moving, see `.w-turn` and the others in washi.css */
const MOVING = /\bw-(?:turn|turn-slow|breathe|blink)\b/;

type Props = {
  children?: ReactNode;
  className?: unknown;
  filter?: unknown;
  [key: string]: unknown;
};

/** `cloneElement` with new children passed one by one, as JSX does, so static children need no keys */
function clone(node: ReactElement<Props>, props: Props, children: ReactNode): ReactElement<Props> {
  return Array.isArray(children)
    ? cloneElement(node, props, ...(children as ReactNode[]))
    : cloneElement(node, props, children);
}

/** the figure as host elements only: its components are pure drawings without hooks, so they are called here */
function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(expand);
  if (!isValidElement<Props>(node)) return node;
  if (typeof node.type === "function") {
    const out = expand((node.type as (props: Props) => ReactNode)(node.props));
    // the drawing keeps the key of the component it came from, inside the lists of its parent
    if (node.key == null) return out;
    return isValidElement(out)
      ? cloneElement(out, { key: node.key })
      : createElement(Fragment, { key: node.key }, out);
  }
  if (node.props.children === undefined) return node;
  return clone(node, {}, expand(node.props.children));
}

function isMoving(node: ReactElement<Props>): boolean {
  if (typeof node.props.className === "string" && MOVING.test(node.props.className)) return true;
  // a part that travels along a path, see `Travel`
  return typeof node.props["data-travel"] === "string";
}

/** the painting without its moving parts */
function withoutMoving(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(withoutMoving);
  if (!isValidElement<Props>(node)) return node;
  if (isMoving(node)) return null;
  if (node.props.children === undefined) return node;
  return clone(node, {}, withoutMoving(node.props.children));
}

function withoutFilters(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(withoutFilters);
  if (!isValidElement<Props>(node)) return node;
  // only elements of the page take a filter; a fragment takes nothing but children
  const props = typeof node.type === "string" ? { filter: undefined } : {};
  if (node.props.children === undefined) return cloneElement(node, props);
  return clone(node, props, withoutFilters(node.props.children));
}

/** a moving part and the groups around it that place it, outermost first */
interface Part {
  chain: ReactElement<Props>[];
  node: ReactElement<Props>;
}

/** collects the moving parts: those moved by a class, and those that travel along a path */
function collect(node: ReactNode, chain: ReactElement<Props>[], parts: Part[], travels: Part[]) {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, chain, parts, travels);
    return;
  }
  if (!isValidElement<Props>(node)) return;
  if (typeof node.props["data-travel"] === "string") travels.push({ chain, node });
  else if (isMoving(node)) parts.push({ chain, node });
  else collect(node.props.children, [...chain, node], parts, travels);
}

/** the part inside copies of the groups around it, which keep their transforms and classes but drop filters */
function wrap({ chain }: Part, inner: ReactNode): ReactNode {
  let out = inner;
  for (let i = chain.length - 1; i >= 1; i--) {
    const group = chain[i]!;
    out = clone(group, typeof group.type === "string" ? { filter: undefined } : {}, out);
  }
  return out;
}

/**
 * Renders a painted SVG figure in layers: below, the painting with its filters and without the moving parts, so it
 * never repaints; above, each moving part in a box of its own, without filters. The part's motion class moves onto
 * that box, a `<div>`, which the browser animates on the compositor at the display's rate with no work on the page
 * (it does not for an `<svg>` element). `Parts` shrinks each box to its part's bounds, and carries the parts that
 * travel along a path (`data-travel`). The figure is pruned here, so no copy carries another's nodes.
 */
export function Layered({ children, className }: { children: ReactNode; className?: string }) {
  const figure = expand(children);
  if (!isValidElement<Props>(figure)) return <div className={className}>{figure}</div>;

  const parts: Part[] = [];
  const travels: Part[] = [];
  collect(figure.props.children, [figure], parts, travels);
  const viewBox = figure.props.viewBox as string | undefined;
  const [, , vw = 1, vh = 1] = (viewBox ?? "").split(/\s+/).map(Number);

  return (
    <div className={className ? `relative ${className}` : "relative"}>
      <div className="w-static">{withoutMoving(figure)}</div>
      {parts.length + travels.length > 0 && (
        <div className="w-overlay" aria-hidden>
          {travels.map(({ node }, i) => {
            const { children: inside, ...data } = node.props;
            // a slip of 16 units, laid at the top left and carried along its path by `Parts`
            return (
              <div
                key={`t${i}`}
                className="w-part w-travel"
                data-travel={data["data-travel"] as string}
                data-cycle={data["data-cycle"] as number}
                data-share={data["data-share"] as number}
                data-delay={data["data-delay"] as number}
                style={{ width: `${(16 / vw) * 100}%`, height: `${(16 / vh) * 100}%` }}
              >
                <svg viewBox="-8 -8 16 16">{withoutFilters(inside as ReactNode)}</svg>
              </div>
            );
          })}
          {parts.map((part, i) => {
            const { className: classes, style, children: inside, ...rest } = part.node.props;
            const names = String(classes).split(/\s+/).filter(Boolean);
            // what times the motion moves up with it: custom properties of the part and the groups around it (`--i`),
            // and the part's own animation settings (a gear turning the other way, or slower)
            const timing = (s: unknown, own: boolean) =>
              Object.entries((s as Record<string, unknown> | undefined) ?? {}).filter(
                ([k]) => k.startsWith("--") || (own && k.startsWith("animation")),
              );
            const vars = Object.fromEntries([
              ...part.chain.flatMap((g) => timing(g.props.style, false)),
              ...timing(style, true),
            ]) as CSSProperties;
            const others = names.filter((c) => !MOVING.test(c)).join(" ");
            const inner = clone(
              part.node,
              { ...rest, className: others || undefined, style: undefined, filter: undefined },
              withoutFilters(inside as ReactNode),
            );
            // the motion sits on a <div>: browsers run transform and opacity animations of an element of the page on
            // the compositor, but not those of an <svg> element
            return (
              <div
                key={i}
                className={`w-part ${names.filter((c) => MOVING.test(c)).join(" ")}`}
                style={vars}
              >
                <svg viewBox={viewBox}>
                  <g>{wrap(part, inner)}</g>
                </svg>
              </div>
            );
          })}
          <Parts />
        </div>
      )}
    </div>
  );
}
