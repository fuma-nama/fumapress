import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Brush, Fill, gear, ptsOfCircle, rr, cast } from "../pen";

/* figure: layouts, three etched glass plates standing in a slide rack */

type Kind = "Docs" | "Notebook" | "Home";

const W = 158; // plate width
const H = 150; // plate height, the bottom sinks into the rack
const GLASS = { x: 8, y: 16, w: 142, h: 89 }; // a 16:10 screen inside a plate
const LIP = 146; // where the plates enter the rack
const F = 145; // top of the front face of the rack
const plates: { kind: Kind; x: number; y: number }[] = [
  { kind: "Docs", x: 15, y: 27 },
  { kind: "Notebook", x: 180, y: 17 },
  { kind: "Home", x: 345, y: 27 },
];

/** a circle of absolute commands, so a brush can follow it */
function ring(cx: number, cy: number, r: number) {
  const k = r * 0.5523;
  const f = (n: number) => +n.toFixed(2);
  return `M${f(cx + r)} ${f(cy)}C${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}C${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}C${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)}C${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}Z`;
}

const paintOf: Record<string, string> = {
  ink: "w-f-ink",
  soft: "w-f-soft",
  gloss: "w-f-gloss",
  blue: "w-f-blue",
  cream: "w-f-cream",
  green: "w-f-green-deep",
  indigo: "w-f-indigo",
};

/**
 * Brush strokes along each part of a path: open parts taper, closed parts are painted as
 * overlapping strokes. `bold` lays a contour in three strokes.
 */
function Stroke({
  d,
  w = 1.4,
  c = "ink",
  o,
  bold,
  taper,
  pressure,
}: {
  d: string;
  w?: number;
  c?: keyof typeof paintOf;
  o?: number;
  bold?: boolean;
  taper?: [number, number];
  pressure?: number;
}) {
  return (
    <>
      {(d.match(/M[^M]+/g) ?? []).map((part, k) => {
        const closed = /Z\s*$/.test(part);
        return (
          <Brush
            key={k}
            d={part}
            w={w * 1.35}
            c={paintOf[c]}
            o={o}
            loop={closed ? (bold ? 3 : 2) : undefined}
            taper={taper ?? (closed ? undefined : [0.06, 0.3])}
            pressure={pressure ?? (bold ? 0.32 : 0.18)}
          />
        );
      })}
    </>
  );
}

/** a run of short rules, one per entry of `lens` (0 skips a row) */
function rules(x: number, y0: number, step: number, lens: number[]) {
  return lens.map((l, i) => (l ? `M${x} ${y0 + i * step}H${x + l}` : "")).join("");
}

/** stagger of the motion classes of washi.css */
function at(i: number) {
  return { "--i": i } as CSSProperties;
}

/** a line of the etching that draws itself in */
function Thread({
  d,
  w,
  c = "gloss",
  o,
}: {
  d: string;
  w: number;
  c?: "gloss" | "green";
  o?: number;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      className={`w-s-${c} w-thread`}
      strokeWidth={w}
      opacity={o}
      fill="none"
      strokeLinecap="round"
    />
  );
}

function screw(x: number, y: number, r: number, tilt = 0.6) {
  const dx = r * 0.62;
  const dy = dx * tilt;
  return (
    <g>
      <Stroke d={ring(x, y, r)} w={1.1} />
      <Stroke d={`M${x - dx} ${y + dy}L${x + dx} ${y - dy}`} w={1} />
      <Stroke
        d={`M${x - r * 0.55} ${y - r * 0.35}Q${x - r * 0.2} ${y - r * 0.8} ${x + r * 0.3} ${y - r * 0.75}`}
        w={0.7}
        c="gloss"
        o={0.8}
      />
    </g>
  );
}

/*
 * The layouts etched into each glass, as a desktop screen of 142 x 89: a browser bar of 8, then
 * the page. Few, clean marks, at the proportions of the real layouts.
 */

function BrowserBar() {
  return (
    <>
      <Stroke
        d={`${ring(5, 4, 1.3)}${ring(9.5, 4, 1.3)}${ring(14, 4, 1.3)}`}
        w={0.7}
        c="gloss"
        o={0.7}
      />
      <Stroke d={rr(36, 1.8, 70, 4.4, 2.2)} w={0.6} c="blue" o={0.7} />
      <Stroke d="M0 8H142" w={0.6} c="blue" o={0.55} />
    </>
  );
}

function Logo({ y }: { y: number }) {
  return (
    <>
      <Stroke d={rr(5, y - 2.5, 5, 5, 1.4)} w={0.9} c="gloss" o={0.9} />
      <Stroke d={`M13 ${y}H25`} w={1.6} c="gloss" o={0.85} />
    </>
  );
}

function Search({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <>
      <Stroke d={rr(x, y, w, 6, 2)} w={0.7} c="gloss" o={0.6} />
      <Stroke
        d={`${ring(x + 3.5, y + 3, 1.3)}M${x + 4.5} ${y + 4}L${x + 5.5} ${y + 5}`}
        w={0.6}
        c="gloss"
        o={0.6}
      />
    </>
  );
}

/** the table of contents column, with its active marker */
function Toc({ y }: { y: number }) {
  return (
    <>
      <Stroke d={`M118 ${y}H132`} w={0.8} c="blue" o={0.9} />
      <Stroke d={`M118 ${y + 6}V${y + 31}`} w={0.6} c="blue" o={0.45} />
      <Stroke d={rules(121, y + 8, 7, [12, 0, 13, 8])} w={0.8} c="gloss" o={0.55} />
      <Stroke d={`M121 ${y + 15}H131`} w={0.9} c="gloss" o={0.95} />
      <Thread d={`M118 ${y + 12}V${y + 18}`} w={2} c="green" />
    </>
  );
}

/** sidebar items, the active one on a pale green pill */
function SidebarItems({ y, active, lens }: { y: number; active: number; lens: number[] }) {
  const ay = y + active * 7;
  return (
    <>
      <g filter="url(#w-wash)">
        <Fill d={rr(2.5, ay - 3, 22, 6, 2)} c="w-f-green" o={0.6} />
      </g>
      <Stroke
        d={rules(
          6,
          y,
          7,
          lens.map((l, i) => (i === active ? 0 : l)),
        )}
        w={0.9}
        c="gloss"
        o={0.6}
      />
      <Thread d={`M6 ${ay}H${6 + lens[active]!}`} w={1.1} o={0.95} />
    </>
  );
}

function DocsEtching() {
  return (
    <>
      <g filter="url(#w-wash)">
        <Fill d={rr(36, 52, 72, 17, 2)} c="w-f-indigo" o={0.45} />
      </g>
      <BrowserBar />
      {/* sidebar, a fifth of the width */}
      <Stroke d="M28 8V89" w={0.6} c="blue" o={0.55} />
      <Logo y={15} />
      <Search x={4} y={21} w={20} />
      <SidebarItems y={36} active={1} lens={[15, 17, 12, 16, 11, 14]} />
      <Stroke d="M5 76H13" w={0.6} c="blue" o={0.8} />
      <Stroke d="M6 82H18" w={0.9} c="gloss" o={0.6} />
      {/* content column */}
      <Thread d="M36 18H80" w={3} o={0.9} />
      <Stroke d={rules(36, 27, 5, [72, 68, 44])} w={0.9} c="gloss" o={0.55} />
      <Stroke d="M36 46H62" w={2} c="gloss" o={0.85} />
      <Stroke d={rr(36, 52, 72, 17, 2)} w={0.6} c="blue" o={0.8} />
      <Stroke d="M41 58H58M41 64H54" w={0.9} c="cream" o={0.85} />
      <Stroke d="M61 58H78M58 64H84" w={0.9} c="green" o={0.95} />
      <Stroke d={rules(36, 76, 5, [70, 52])} w={0.9} c="gloss" o={0.55} />
      {/* table of contents */}
      <Toc y={15} />
    </>
  );
}

function NotebookEtching() {
  return (
    <>
      <g filter="url(#w-wash)">
        <Fill d="M0 8H142V17H0Z" c="w-f-indigo" o={0.5} />
        <Fill d={rr(36, 55, 72, 13, 2)} c="w-f-green" o={0.2} />
      </g>
      <BrowserBar />
      {/* navbar across the full width */}
      <Stroke d="M0 17H142" w={0.8} c="gloss" o={0.55} />
      <Logo y={12.5} />
      <Stroke d="M40 12.5H50M56 12.5H66" w={0.9} c="gloss" o={0.7} />
      <Thread d="M40 16H50" w={1.4} c="green" />
      <Search x={98} y={9.5} w={28} />
      <g className="w-blink">
        <Stroke d="M106 10.8V14.2" w={0.8} c="gloss" />
      </g>
      <Stroke d={ring(134, 12.5, 2.2)} w={0.7} c="gloss" o={0.7} />
      {/* sidebar below it */}
      <Stroke d="M28 17V89" w={0.6} c="blue" o={0.55} />
      <Stroke d="M5 24H15" w={0.6} c="blue" o={0.85} />
      <SidebarItems y={31} active={1} lens={[16, 13, 17, 12, 15, 11, 14]} />
      {/* content */}
      <Thread d="M36 27H76" w={3} o={0.9} />
      <Stroke d={rules(36, 36, 5, [72, 66, 50])} w={0.9} c="gloss" o={0.55} />
      <Thread d="M37 56V67" w={2} c="green" />
      <Stroke d="M42 59H96M42 64H84" w={0.8} c="gloss" o={0.6} />
      <Stroke d={rules(36, 76, 5, [70, 58])} w={0.9} c="gloss" o={0.55} />
      <Toc y={24} />
    </>
  );
}

function HomeEtching() {
  return (
    <>
      <g filter="url(#w-wash)">
        <Fill d={rr(118, 9.8, 18, 5.4, 2.5)} c="w-f-green" o={0.6} />
        <Fill d={rr(49, 51, 20, 7, 3)} c="w-f-gloss" o={0.8} />
        {[13, 54, 95].map((x) => (
          <Fill key={x} d={rr(x, 65, 34, 19, 2.5)} c="w-f-indigo" o={0.32} />
        ))}
        <Fill d="M30 24Q71 20 112 24L118 46Q71 50 24 46Z" c="w-f-indigo" o={0.16} />
      </g>
      <BrowserBar />
      {/* navbar */}
      <Stroke d="M0 17H142" w={0.6} c="blue" o={0.55} />
      <Logo y={12.5} />
      <Stroke d="M56 12.5H64M70 12.5H78M84 12.5H92" w={0.9} c="gloss" o={0.65} />
      <Stroke d={rr(118, 9.8, 18, 5.4, 2.5)} w={0.6} c="green" />
      {/* hero, centered */}
      <Thread d="M36 31H106" w={3.4} o={0.92} />
      <Thread d="M46 38.5H96" w={3.4} o={0.92} />
      <Stroke d="M44 45.5H98" w={0.8} c="gloss" o={0.55} />
      <Stroke d={rr(73, 51, 20, 7, 3)} w={0.7} c="gloss" o={0.75} />
      <Stroke d="M53 54.5H65" w={1} c="ink" o={0.8} />
      <Stroke d="M77 54.5H89" w={0.7} c="gloss" o={0.6} />
      {/* a row of three cards */}
      {[13, 54, 95].map((x, i) => (
        <g key={x}>
          <Stroke d={rr(x, 65, 34, 19, 2.5)} w={0.6} c="gloss" o={0.6} />
          <Stroke d={rr(x + 4, 69, 5, 5, 1.4)} w={0.8} c={i === 0 ? "green" : "blue"} o={0.95} />
          <Stroke
            d={`M${x + 4} 78H${x + 26}M${x + 13} 71.5H${x + 24}`}
            w={0.8}
            c="gloss"
            o={0.55}
          />
        </g>
      ))}
    </>
  );
}

const etchings: Record<Kind, () => ReactElement> = {
  Docs: DocsEtching,
  Notebook: NotebookEtching,
  Home: HomeEtching,
};

/** a plate and its shadow, keyed so that hovering one brings out its plaque */
function Motion({ kind, children }: { kind: Kind; children: ReactNode }) {
  return <g data-key={kind.toLowerCase()}>{children}</g>;
}

function PlateBody({ kind, x, y, i }: { kind: Kind; x: number; y: number; i: number }) {
  const gx = x + GLASS.x;
  const gy = y + GLASS.y;
  const { w: gw, h: gh } = GLASS;
  const cx = x + W / 2;
  const Etching = etchings[kind];
  const raised = kind === "Notebook";

  return (
    <g>
      {/* frame: an opaque ground, the wash, light on the near side, form shadow on the far side */}
      <Fill d={rr(x + 2, y + 2, W - 4, H - 4, 7)} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={rr(x, y, W, H, 8)} c="w-f-indigo" o={0.64} />
        <Fill
          d={`M${x + 3} ${y + 26}Q${x + 2} ${y + 4} ${x + 30} ${y + 3}H${x + 70}Q${x + 20} ${y + 10} ${x + 7} ${y + 70}Z`}
          c="w-f-gloss"
          o={0.16}
        />
        <Fill d={`M${x + 2} ${gy + gh + 3}H${x + W - 2}V${LIP}H${x + 2}Z`} c="w-f-deep" o={0.16} />
        <Fill
          d={`M${x + W - 12} ${y + 3}Q${x + W - 1} ${y + 4} ${x + W - 1} ${y + 16}V${y + H}H${x + W - 7}V${y + 18}Q${x + W - 7} ${y + 8} ${x + W - 12} ${y + 3}Z`}
          c="w-f-deep"
          o={0.3}
        />
        <Fill
          d={`M${x + 4} ${y + 13.5}H${x + W - 4}V${y + 15.5}H${x + 4}Z`}
          c="w-f-deep"
          o={0.22}
        />
        <Fill d={rr(cx - 14, y + 4, 30, 9, 3)} c="w-f-deep" o={0.25} />
      </g>

      {/* glass */}
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(gx, gy, gw, gh, 3)} c="w-f-deep" />
      </g>
      <g filter="url(#w-paint)">
        {/* masses of the frame, in strokes of several blues */}
        <Brush
          d={`M${x + 4.5} ${y + 12}Q${x + 3.5} ${y + 80} ${x + 4.5} ${LIP}`}
          w={7}
          c="w-f-indigo"
          taper={[0.04, 0]}
          pressure={0.15}
        />
        <Brush
          d={`M${x + 5.5} ${y + 16}Q${x + 5} ${y + 80} ${x + 5.5} ${LIP}`}
          w={4}
          c="w-f-gloss"
          o={0.4}
          taper={[0.06, 0]}
        />
        <Brush d={`M${x + W - 4} ${y + 14}V${LIP}`} w={6} c="w-f-label" o={0.8} taper={[0.04, 0]} />
        <Brush
          d={`M${x + 12} ${y + 8}H${x + W - 12}`}
          w={8}
          c="w-f-indigo"
          o={0.9}
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        <Brush
          d={`M${x + 14} ${y + 4.5}H${x + W - 16}`}
          w={3}
          c="w-f-gloss"
          o={0.35}
          taper={[0.06, 0.1]}
        />
        <Brush
          d={`M${x + 10} ${gy + gh + 9}H${x + W - 10}`}
          w={8}
          c="w-f-gloss"
          o={0.24}
          taper={[0.06, 0.1]}
          pressure={0.2}
        />
        <Brush
          d={`M${x + 10} ${gy + gh + 22}H${x + W - 10}`}
          w={12}
          c="w-f-label"
          o={0.4}
          taper={[0.05, 0.05]}
        />
        <Brush
          d={`M${x + 20} ${gy + gh + 15}H${x + 60}`}
          w={6}
          c="w-f-blue"
          o={0.24}
          taper={[0.4, 0.4]}
        />
        <Brush
          d={`M${x + W - 60} ${gy + gh + 14}H${x + W - 20}`}
          w={6}
          c="w-f-deep"
          o={0.22}
          taper={[0.4, 0.4]}
        />
        {/* glazes over the dark glass, before the etching */}
        <Brush
          d={`M${gx + 14} ${gy + 4}V${gy + gh - 4}`}
          w={22}
          c="w-f-label"
          o={0.4}
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        <Brush
          d={`M${gx + gw * 0.52} ${gy + 4}V${gy + gh - 4}`}
          w={56}
          c="w-f-label"
          o={0.28}
          taper={[0.04, 0.04]}
          pressure={0.12}
        />
        <Brush
          d={`M${gx + gw - 12} ${gy + 4}V${gy + gh - 4}`}
          w={20}
          c="w-f-green-deep"
          o={0.16}
          taper={[0.04, 0.04]}
          pressure={0.12}
        />
        <Brush
          d={`M${gx + 30} ${gy + gh - 6}Q${gx + 24} ${gy + gh * 0.5} ${gx + 40} ${gy + 8}`}
          w={10}
          c="w-f-indigo"
          o={0.2}
          taper={[0.3, 0.3]}
        />
        <Brush
          d={`M${gx + 3} ${gy + 2.6}H${gx + gw - 3}`}
          w={2.6}
          c="w-f-gloss"
          o={0.4}
          taper={[0.02, 0.03]}
          pressure={0.2}
        />
        <Brush
          d={`M${gx + 2.6} ${gy + 3}V${gy + gh - 3}`}
          w={2.6}
          c="w-f-gloss"
          o={0.42}
          taper={[0.02, 0.03]}
        />
        {/* sheen on the glass */}
        <Brush
          d={`M${gx + gw * 0.42} ${gy + 6}Q${gx + gw * 0.2} ${gy + gh * 0.35} ${gx + 8} ${gy + gh * 0.8}`}
          w={22}
          c="w-f-indigo"
          o={0.22}
          taper={[0.2, 0.3]}
          pressure={0.2}
        />
        <Brush
          d={`M${gx + gw - 8} ${gy + gh * 0.4}Q${gx + gw - 22} ${gy + gh * 0.75} ${gx + gw - 44} ${gy + gh - 6}`}
          w={16}
          c="w-f-indigo"
          o={0.18}
          taper={[0.3, 0.3]}
        />
      </g>

      {/* the etching: brush marks, crisp enough to read */}
      <g filter="url(#w-ink)">
        <g transform={`translate(${gx} ${gy})`} style={at(2 + i * 0.6)}>
          <Etching />
        </g>
      </g>

      <g filter="url(#w-paint)">
        {/* occlusion where the frame overhangs the glass, light on the far lip */}
        <Stroke
          d={`M${gx + 1.5} ${gy + gh - 4}V${gy + 1.5}H${gx + gw - 4}`}
          w={2.6}
          c="ink"
          o={0.55}
        />
        <Stroke
          d={`M${gx + gw + 1.2} ${gy + 6}V${gy + gh + 1.2}H${gx + 6}`}
          w={1.4}
          c="blue"
          o={0.6}
        />

        {/* glints on the glass */}
        <Stroke
          d={`M${gx + gw * 0.7} ${gy + 3}Q${gx + gw * 0.58} ${gy + gh * 0.3} ${gx + gw * 0.5} ${gy + gh * 0.5}`}
          w={1.1}
          c="gloss"
          o={0.5}
        />
        <Stroke
          d={`M${gx + gw * 0.47} ${gy + gh * 0.58}Q${gx + gw * 0.4} ${gy + gh * 0.8} ${gx + gw * 0.35} ${gy + gh - 3}`}
          w={0.8}
          c="gloss"
          o={0.4}
        />
        <Stroke
          d={`M${gx + gw * 0.78} ${gy + 3}Q${gx + gw * 0.62} ${gy + gh * 0.45} ${gx + gw * 0.46} ${gy + gh - 3}`}
          w={0.5}
          c="gloss"
          o={0.35}
        />
        <Stroke
          d={`M${gx + 5} ${gy + 26}Q${gx + 12} ${gy + 12} ${gx + 28} ${gy + 5}`}
          w={0.9}
          c="gloss"
          o={0.5}
        />
        <Stroke
          d={`M${gx + gw - 7} ${gy + 26}Q${gx + gw - 4} ${gy + 40} ${gx + gw - 6} ${gy + 56}`}
          w={1.4}
          c="gloss"
          o={0.7}
        />
        <Stroke
          d={`M${gx + 4.5} ${gy + gh - 20}Q${gx + 4} ${gy + gh - 10} ${gx + 9} ${gy + gh - 5}`}
          w={1.1}
          c="gloss"
          o={0.55}
        />

        {/* frame edges: rim light on the shadow side, gloss on the lit side */}
        <Stroke d={`M${x + W - 2.8} ${y + 14}V${LIP}`} w={2.2} c="blue" o={0.5} />
        <Stroke
          d={`M${x + 3} ${y + 12}Q${x + 2.4} ${y + 70} ${x + 3} ${LIP}`}
          w={1.1}
          c="gloss"
          o={0.75}
        />
        <Stroke d={`M${x + 12} ${y + 2.6}H${cx - 20}`} w={1.2} c="gloss" o={0.8} />
        <Stroke d={`M${cx + 22} ${y + 3}H${x + W - 22}`} w={0.6} c="gloss" o={0.6} />
        <Stroke
          d={`M${x + 3.6} ${y + 9}Q${x + 3.6} ${y + 4} ${x + 8} ${y + 2.4}`}
          w={1}
          c="gloss"
          o={0.85}
        />
        <Stroke d={`M${gx - 4} ${gy + gh + 4.5}H${gx + gw + 4}`} w={0.7} c="soft" o={0.7} />
        <Stroke
          d={`M${x + W - 5} ${gy + 12}L${x + W - 4.7} ${gy + 26}`}
          w={0.6}
          c="cream"
          o={0.6}
        />

        {/* engraved ticks along the top rail */}
        {Array.from({ length: 11 }, (_, k) => (
          <g key={k}>
            <Stroke
              d={`M${x + 18 + k * 4} ${y + 11.5}V${y + (k % 5 === 0 ? 6 : 8.5)}`}
              w={0.6}
              c="gloss"
              o={0.55}
            />
            <Stroke
              d={`M${x + W - 18 - k * 4} ${y + 11.5}V${y + (k % 5 === 0 ? 6 : 8.5)}`}
              w={0.6}
              c="gloss"
              o={0.55}
            />
          </g>
        ))}

        {/* contours */}
        <Brush
          d={rr(x, y, W, H, 8)}
          w={3.4}
          c="w-f-label"
          loop={3}
          seed={i * 7 + 3}
          pressure={0.35}
        />
        <Brush
          d={rr(x + 0.6, y + 0.6, W - 1.2, H - 1.2, 7.5)}
          w={1.6}
          c="w-f-ink"
          o={0.9}
          loop={3}
          seed={i * 7 + 5}
        />
        <Brush
          d={`M${x + 2.4} ${y + 14}Q${x + 1.6} ${y + 80} ${x + 2.6} ${LIP - 4}`}
          w={3}
          c="w-f-gloss"
          o={0.9}
          taper={[0.12, 0.55]}
          pressure={0.4}
        />
        <Brush
          d={`M${x + 7} ${gy + 6}V${gy + gh - 10}`}
          w={1.2}
          c="w-f-cream"
          o={0.8}
          taper={[0.3, 0.3]}
        />
        <Brush
          d={`M${x + W - 1.8} ${y + 16}V${LIP - 4}`}
          w={2.2}
          c="w-f-blue"
          o={0.6}
          taper={[0.3, 0.3]}
        />
        <Stroke d={rr(gx - 2.5, gy - 2.5, gw + 5, gh + 5, 4)} w={0.8} c="soft" />
        <Stroke bold d={rr(gx, gy, gw, gh, 3)} w={1.1} />
        {[
          [x + 8, y + 8],
          [x + W - 8, y + 8],
          [x + 4, gy + gh / 2],
          [x + W - 4, gy + gh / 2],
        ].map(([sx = 0, sy = 0], k) => (
          <g key={k}>{screw(sx, sy, k < 2 ? 3.6 : 2, k % 2 ? -0.5 : 0.7)}</g>
        ))}
        {raised && (
          <>
            {/* the lifted plate shows its ruled tag */}
            <Stroke d={rr(cx - 24, gy + gh + 8, 48, 9, 2)} w={0.8} c="gloss" o={0.7} />
            <Stroke d={`M${cx - 19} ${gy + gh + 12.5}H${cx + 12}`} w={0.6} c="gloss" o={0.6} />
          </>
        )}
      </g>

      {/* the brass clip that lifts the plate */}
      <g filter="url(#w-wash)">
        <Fill d={rr(cx - 15, y - 5, 30, 12, 4)} c="w-f-sheet" o={0.95} />
        <Fill
          d={`M${cx + 7} ${y - 4}Q${cx + 14} ${y - 4} ${cx + 14} ${y + 2}V${y + 3}Q${cx + 14} ${y + 6} ${cx + 9} ${y + 6}Z`}
          c="w-f-deep"
          o={0.22}
        />
      </g>
      <g filter="url(#w-paint)">
        <Stroke d={`M${cx - 11} ${y - 1.4}H${cx + 11}`} w={2.6} c="cream" o={0.95} />
        <Stroke d={`M${cx - 11} ${y + 3.6}H${cx + 10}`} w={1.4} c="cream" o={0.7} />
        {[-7, -4, -1, 2, 5, 8].map((d) => (
          <Stroke key={d} d={`M${cx + d} ${y + 0.3}V${y + 2.4}`} w={0.5} c="soft" o={0.8} />
        ))}
        <Stroke bold d={rr(cx - 15, y - 5, 30, 12, 4)} w={1.1} />
        <Stroke d={`M${cx - 12} ${y - 3.2}H${cx + 4}`} w={0.8} c="gloss" o={0.9} />
      </g>
      <g filter="url(#w-wash)">
        <Fill d={ring(gx + 7, gy + 15, 1.2)} c="w-f-gloss" o={0.7} />
        <Fill d={`M${gx + gw - 18} ${gy + 6}q4 -1 5 2q-3 1 -5 -2Z`} c="w-f-gloss" o={0.8} />
      </g>
    </g>
  );
}

/* the rack */

const plaques = plates.map((p) => p.x + W / 2);
const vents = [160, 166, 172, 178, 184, 330, 336, 342];
const lamp = plaques[1]! + 64;
const capX = [6, 492];

/** the name plate of a layout, on the front of the rack */
function Plaque({ kind, cx }: { kind: Kind; cx: number }) {
  const t = F + 13; // top of the plaque
  return (
    <g data-key={kind.toLowerCase()}>
      <g filter="url(#w-wash)">
        <Fill d={rr(cx - 53, t + 3, 112, 25, 3)} c="w-f-deep" o={0.3} />
        <Fill d={rr(cx - 56, t, 112, 25, 3)} c="w-f-sheet" o={0.97} />
        <Fill
          d={`M${cx + 52} ${t + 1}Q${cx + 55} ${t + 1} ${cx + 55} ${t + 4}V${t + 21}Q${cx + 55} ${t + 24} ${cx + 52} ${t + 24}H${cx - 52}Q${cx + 50} ${t + 22} ${cx + 52} ${t + 1}Z`}
          c="w-f-shadow"
          o={0.7}
        />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          d={`M${cx - 52} ${t + 22}H${cx + 52}`}
          w={4}
          c="w-f-blue"
          o={0.3}
          taper={[0.15, 0.2]}
        />
        <Brush
          d={`M${cx + 52.5} ${t + 4}V${t + 21}`}
          w={3}
          c="w-f-blue"
          o={0.3}
          taper={[0.2, 0.2]}
        />
        <Stroke bold d={rr(cx - 56, t, 112, 25, 3)} w={1.1} />
        <Stroke d={`M${cx - 53} ${t + 2.6}H${cx + 34}`} w={0.8} c="gloss" o={0.9} />
        <Stroke d={`${ring(cx - 51, t + 12.5, 1.8)}${ring(cx + 51, t + 12.5, 1.8)}`} w={0.9} />
        <Stroke
          d={`M${cx - 52.2} ${t + 13.6}L${cx - 49.8} ${t + 11.4}M${cx + 49.8} ${t + 13.6}L${cx + 52.2} ${t + 11.4}`}
          w={0.6}
        />
        <Stroke
          d={`M${cx - 46} ${t + 10}H${cx - 41}M${cx - 46} ${t + 15}H${cx - 43}M${cx + 41} ${t + 10}H${cx + 46}M${cx + 43} ${t + 15}H${cx + 46}`}
          w={0.6}
          c="soft"
          o={0.8}
        />
      </g>
      <text x={cx} y={t + 17} fontSize={13} textAnchor="middle" className="w-f-text w-serif">
        {kind}
      </text>
    </g>
  );
}

/*
 * The workbench below the rack: the Fumadocs CLI at a terminal, corded to the rack, prints a
 * component on a card that slides down a chute into the card box of the project.
 */

const TB = { x: 14, y: 236, w: 234, h: 160 }; // terminal body
const TS = { x: 32, y: 252, w: 200, h: 112 }; // its screen, near 16:9
const tCaps = [8, 240];
const CAP_Y = 242;
const CAP_H = 146;
const tVents = [140, 146, 152, 158, 164, 170];
const tLamp = [204, 380] as const;
/** the screen lines, from the baseline of the first */
const LINE_Y = 292;
const LINE_STEP = 23;
const MONO = 10;
/** the cord from the underside of the rack to the socket on top of the terminal */
const cordD = "M104 203C103 221 138 210 137 228";

/** the card box: back rim, front rim, foot */
const BX = { top: 332, front: 375, foot: 424, l: 290, r: 506, bl: 304, br: 492 };
const interior = `M${BX.bl} ${BX.top}H${BX.br}L${BX.r} ${BX.front}H${BX.l}Z`;
const dividers = [
  { label: "app", top: 300, x0: 313, x1: 483, tab: 320 },
  { label: "content", top: 309, x0: 310, x1: 486, tab: 394 },
  { label: "lib", top: 318, x0: 307, x1: 489, tab: 452 },
];
/** the new card where it comes to rest, before its tilt */
const CARD = { x: 334, y: 322, w: 70, h: 92 };
/** the bed of the chute, between its back and front rails, and the face of the front rail */
const chuteTop = "M250 338L324 362.7L324 377.7L250 353Z";
const chuteLip = "M250 353L324 377.7L324 383.7L250 359Z";

/** the terminal: an indigo case like the rack, with a dark screen where the CLI runs */
function TerminalBody() {
  const { x, y, w, h } = TB;
  const { x: gx, y: gy, w: gw, h: gh } = TS;
  const r = x + w;
  const b = y + h;
  const band = gy + gh; // top of the lower band
  return (
    <g>
      <g filter="url(#w-wash)">
        {[36, 196].map((fx) => (
          <Fill key={fx} d={rr(fx, b - 2, 30, 9, 2)} c="w-f-deep" o={0.8} />
        ))}
      </g>
      <Fill d={rr(x + 2, y + 2, w - 4, h - 4, 8)} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={rr(x, y, w, h, 9)} c="w-f-indigo" o={0.64} />
        <Fill
          d={`M${x + 3} ${y + 30}Q${x + 2} ${y + 4} ${x + 34} ${y + 3}H${x + 110}Q${x + 30} ${y + 10} ${x + 8} ${y + 84}Z`}
          c="w-f-gloss"
          o={0.16}
        />
        <Fill d={`M${x + 2} ${band + 3}H${r - 2}V${b - 3}H${x + 2}Z`} c="w-f-deep" o={0.16} />
        <Fill
          d={`M${r - 16} ${y + 3}Q${r - 1} ${y + 4} ${r - 1} ${y + 18}V${b - 6}H${r - 9}V${y + 20}Q${r - 9} ${y + 8} ${r - 16} ${y + 3}Z`}
          c="w-f-deep"
          o={0.3}
        />
        <Fill d={`M${x + 4} ${gy - 4}H${r - 4}V${gy - 2}H${x + 4}Z`} c="w-f-deep" o={0.22} />
        <Fill d={rr(42, band + 6, 92, 21, 3)} c="w-f-deep" o={0.3} />
      </g>

      <g filter="url(#w-wash-dense)">
        <Fill d={rr(gx, gy, gw, gh, 3)} c="w-f-deep" />
        {tVents.map((vx) => (
          <Fill key={vx} d={rr(vx, band + 7, 3, 19, 1.5)} c="w-f-deep" />
        ))}
        <Fill d={ring(tLamp[0], tLamp[1], 5.6)} c="w-f-deep" />
        <Fill d={rr(126, y - 3, 22, 7, 2)} c="w-f-deep" />
      </g>

      <g filter="url(#w-paint)">
        {/* masses of the case */}
        <Brush
          d={`M${x + 4.5} ${y + 12}Q${x + 3.5} ${y + 80} ${x + 4.5} ${b - 8}`}
          w={7}
          c="w-f-indigo"
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        <Brush
          d={`M${x + 5.5} ${y + 16}Q${x + 5} ${y + 80} ${x + 5.5} ${b - 10}`}
          w={4}
          c="w-f-gloss"
          o={0.4}
          taper={[0.06, 0.1]}
        />
        <Brush
          d={`M${r - 4} ${y + 14}V${b - 8}`}
          w={6}
          c="w-f-label"
          o={0.8}
          taper={[0.04, 0.04]}
        />
        <Brush
          d={`M${x + 12} ${y + 8}H${r - 12}`}
          w={8}
          c="w-f-indigo"
          o={0.9}
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        <Brush
          d={`M${x + 14} ${y + 4.5}H${r - 18}`}
          w={3}
          c="w-f-gloss"
          o={0.35}
          taper={[0.06, 0.1]}
        />
        <Brush
          d={`M${x + 10} ${band + 7}H${r - 10}`}
          w={7}
          c="w-f-gloss"
          o={0.22}
          taper={[0.06, 0.1]}
          pressure={0.2}
        />
        <Brush
          d={`M${x + 10} ${b - 7}H${r - 10}`}
          w={9}
          c="w-f-label"
          o={0.45}
          taper={[0.05, 0.05]}
        />
        <Brush d={`M136 ${band + 16}H184`} w={6} c="w-f-blue" o={0.22} taper={[0.4, 0.4]} />
        {/* glazes over the dark glass */}
        <Brush
          d={`M${gx + 14} ${gy + 4}V${gy + gh - 4}`}
          w={22}
          c="w-f-label"
          o={0.4}
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        <Brush
          d={`M${gx + gw * 0.55} ${gy + 4}V${gy + gh - 4}`}
          w={70}
          c="w-f-label"
          o={0.26}
          taper={[0.04, 0.04]}
          pressure={0.12}
        />
        <Brush
          d={`M${gx + gw - 12} ${gy + 4}V${gy + gh - 4}`}
          w={20}
          c="w-f-green-deep"
          o={0.14}
          taper={[0.04, 0.04]}
          pressure={0.12}
        />
        <Brush
          d={`M${gx + 40} ${gy + gh - 6}Q${gx + 30} ${gy + gh * 0.5} ${gx + 52} ${gy + 8}`}
          w={12}
          c="w-f-indigo"
          o={0.2}
          taper={[0.3, 0.3]}
        />
        <Brush
          d={`M${gx + gw - 8} ${gy + gh * 0.45}Q${gx + gw - 26} ${gy + gh * 0.8} ${gx + gw - 56} ${gy + gh - 6}`}
          w={18}
          c="w-f-indigo"
          o={0.2}
          taper={[0.3, 0.3]}
        />
        <Brush
          d={`M${gx + 3} ${gy + 2.6}H${gx + gw - 3}`}
          w={2.6}
          c="w-f-gloss"
          o={0.4}
          taper={[0.02, 0.03]}
          pressure={0.2}
        />
        <Brush
          d={`M${gx + 2.6} ${gy + 3}V${gy + gh - 3}`}
          w={2.6}
          c="w-f-gloss"
          o={0.42}
          taper={[0.02, 0.03]}
        />
      </g>

      {/* the title bar etched on the glass */}
      <g filter="url(#w-ink)">
        <g transform={`translate(${gx} ${gy})`}>
          <Stroke
            d={`${ring(7, 6, 1.4)}${ring(12, 6, 1.4)}${ring(17, 6, 1.4)}`}
            w={0.7}
            c="gloss"
            o={0.7}
          />
          <Stroke d={rr(76, 3.4, 48, 5.2, 2.4)} w={0.6} c="blue" o={0.6} />
          <Stroke d={`M0 12H${gw}`} w={0.6} c="blue" o={0.5} />
        </g>
      </g>

      <g filter="url(#w-paint)">
        {/* occlusion under the rim of the glass, light on the far lip */}
        <Stroke
          d={`M${gx + 1.5} ${gy + gh - 4}V${gy + 1.5}H${gx + gw - 4}`}
          w={2.6}
          c="ink"
          o={0.55}
        />
        <Stroke
          d={`M${gx + gw + 1.2} ${gy + 6}V${gy + gh + 1.2}H${gx + 6}`}
          w={1.4}
          c="blue"
          o={0.6}
        />
        {/* glints, clear of the text */}
        <Stroke
          d={`M${gx + gw - 6} ${gy + 18}Q${gx + gw - 3} ${gy + 40} ${gx + gw - 5} ${gy + 62}`}
          w={1.4}
          c="gloss"
          o={0.65}
        />
        <Stroke
          d={`M${gx + gw * 0.86} ${gy + gh - 3}Q${gx + gw * 0.8} ${gy + gh - 18} ${gx + gw * 0.74} ${gy + gh - 26}`}
          w={0.9}
          c="gloss"
          o={0.4}
        />
        <Stroke
          d={`M${gx + gw * 0.93} ${gy + gh - 3}Q${gx + gw * 0.87} ${gy + gh - 22} ${gx + gw * 0.8} ${gy + gh - 34}`}
          w={0.5}
          c="gloss"
          o={0.35}
        />
        <Stroke
          d={`M${gx + 4.5} ${gy + gh - 22}Q${gx + 4} ${gy + gh - 10} ${gx + 9} ${gy + gh - 5}`}
          w={1.1}
          c="gloss"
          o={0.55}
        />
        {/* edges of the case */}
        <Stroke d={`M${r - 2.8} ${y + 14}V${b - 8}`} w={2.2} c="blue" o={0.5} />
        <Stroke
          d={`M${x + 3} ${y + 12}Q${x + 2.4} ${y + 80} ${x + 3} ${b - 8}`}
          w={1.1}
          c="gloss"
          o={0.75}
        />
        <Stroke d={`M${x + 12} ${y + 2.6}H${110}`} w={1.2} c="gloss" o={0.8} />
        <Stroke d={`M160 ${y + 3}H${r - 22}`} w={0.6} c="gloss" o={0.6} />
        <Stroke
          d={`M${x + 3.6} ${y + 9}Q${x + 3.6} ${y + 4} ${x + 8} ${y + 2.4}`}
          w={1}
          c="gloss"
          o={0.85}
        />
        <Stroke d={`M${gx - 4} ${band + 4.5}H${gx + gw + 4}`} w={0.7} c="soft" o={0.7} />
        {Array.from({ length: 9 }, (_, k) => (
          <g key={k}>
            <Stroke
              d={`M${50 + k * 4} ${y + 11.5}V${y + (k % 4 === 0 ? 6 : 8.5)}`}
              w={0.6}
              c="gloss"
              o={0.55}
            />
            <Stroke
              d={`M${214 - k * 4} ${y + 11.5}V${y + (k % 4 === 0 ? 6 : 8.5)}`}
              w={0.6}
              c="gloss"
              o={0.55}
            />
          </g>
        ))}
        {/* vents */}
        {tVents.map((vx) => (
          <Stroke key={vx} d={`M${vx + 3.4} ${band + 8}V${band + 25}`} w={0.6} c="blue" o={0.6} />
        ))}
        {/* contours */}
        <Brush d={rr(x, y, w, h, 9)} w={3.4} c="w-f-label" loop={3} seed={61} pressure={0.35} />
        <Brush
          d={rr(x + 0.6, y + 0.6, w - 1.2, h - 1.2, 8.5)}
          w={1.6}
          c="w-f-ink"
          o={0.9}
          loop={3}
          seed={63}
        />
        <Brush
          d={`M${x + 2.4} ${y + 14}Q${x + 1.6} ${y + 80} ${x + 2.6} ${b - 12}`}
          w={3}
          c="w-f-gloss"
          o={0.9}
          taper={[0.12, 0.55]}
          pressure={0.4}
        />
        <Brush
          d={`M${r - 1.8} ${y + 16}V${b - 12}`}
          w={2.2}
          c="w-f-blue"
          o={0.6}
          taper={[0.3, 0.3]}
        />
        <Stroke d={rr(gx - 2.5, gy - 2.5, gw + 5, gh + 5, 4)} w={0.8} c="soft" />
        <Stroke bold d={rr(gx, gy, gw, gh, 3)} w={1.1} />
        <Stroke d={rr(126, y - 3, 22, 7, 2)} w={0.9} />
        {/* feet */}
        <Stroke d={`${rr(36, b - 2, 30, 9, 2)}${rr(196, b - 2, 30, 9, 2)}`} w={1.1} />
        {[44, 58, 204, 218].map((fx) => (
          <Stroke key={fx} d={ring(fx, b + 3.2, 1.4)} w={0.6} c="gloss" o={0.6} />
        ))}
        {[
          [36, y + 8],
          [226, y + 8],
          [35, band + 16],
          [228, band + 16],
        ].map(([sx = 0, sy = 0], k) => (
          <g key={k}>{screw(sx, sy, k < 2 ? 3.2 : 2.2, k % 2 ? -0.5 : 0.7)}</g>
        ))}
      </g>

      {/* the maker's plate */}
      <g filter="url(#w-wash)">
        <Fill d={rr(44, band + 6, 88, 19, 3)} c="w-f-sheet" o={0.97} />
        <Fill
          d={`M129 ${band + 7}Q131.5 ${band + 7} 131.5 ${band + 10}V${band + 21}Q131.5 ${band + 24} 128 ${band + 24}H48Q126 ${band + 22} 129 ${band + 7}Z`}
          c="w-f-shadow"
          o={0.7}
        />
      </g>
      <g filter="url(#w-paint)">
        <Stroke bold d={rr(44, band + 6, 88, 19, 3)} w={1} />
        <Stroke d={`M47 ${band + 8.4}H116`} w={0.7} c="gloss" o={0.9} />
        <Stroke d={`${ring(48.5, band + 15.5, 1.5)}${ring(127.5, band + 15.5, 1.5)}`} w={0.8} />
      </g>
      <text x={88} y={band + 18.8} fontSize={9.5} textAnchor="middle" className="w-f-text w-serif">
        Fumadocs CLI
      </text>

      {/* the lamp, breathing while the CLI waits */}
      <g filter="url(#w-wash)" className="w-breathe">
        <Fill d={ring(tLamp[0], tLamp[1], 4)} c="w-f-green" />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          pts={ptsOfCircle(tLamp[0], tLamp[1], 2.6, Math.PI * 1.1, Math.PI * 1.6)}
          w={1.2}
          c="w-f-gloss"
          o={0.9}
          taper={[0.2, 0.5]}
        />
        <Stroke d={ring(tLamp[0], tLamp[1], 5.6)} w={1} />
      </g>
    </g>
  );
}

/** the end caps of the terminal: a ribbed grip with a knob on the left, the card slot on the right */
function TerminalCaps() {
  return (
    <g>
      <Fill d={tCaps.map((ex) => rr(ex + 1, CAP_Y + 1, 16, CAP_H - 2, 4)).join("")} c="w-f-paper" />
      <g filter="url(#w-wash)">
        {tCaps.map((ex) => (
          <g key={ex}>
            <Fill d={rr(ex, CAP_Y, 18, CAP_H, 5)} c="w-f-indigo" o={0.62} />
            <Fill d={`M${ex + 12} ${CAP_Y + 3}h6v${CAP_H - 6}h-6Z`} c="w-f-deep" o={0.25} />
          </g>
        ))}
      </g>
      {/* the mouth of the card slot, standing out of the cap */}
      <Fill d={rr(247, 240, 13, 117, 3)} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={rr(246.5, 239.5, 14, 118, 3.5)} c="w-f-indigo" o={0.7} />
        <Fill d="M256 242H260V355H256Z" c="w-f-deep" o={0.3} />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(252.6, 243, 4.2, 110, 1.6)} c="w-f-deep" />
      </g>
      <g filter="url(#w-paint)">
        {tCaps.map((ex) => (
          <g key={ex}>
            <Brush
              d={`M${ex + 4.5} ${CAP_Y + 4}V${CAP_Y + CAP_H - 6}`}
              w={4.5}
              c="w-f-gloss"
              o={0.3}
              taper={[0.05, 0.05]}
            />
            <Brush
              d={`M${ex + 14} ${CAP_Y + 3}V${CAP_Y + CAP_H - 4}`}
              w={4.5}
              c="w-f-label"
              o={0.6}
              taper={[0.05, 0.05]}
            />
            <Brush d={rr(ex, CAP_Y, 18, CAP_H, 5)} w={2.8} c="w-f-label" loop={2} seed={ex + 7} />
            <Stroke bold d={rr(ex, CAP_Y, 18, CAP_H, 5)} w={1.2} />
            <Stroke
              d={`M${ex + 3} ${CAP_Y + 4}Q${ex + 2} ${CAP_Y + 70} ${ex + 3} ${CAP_Y + CAP_H - 8}`}
              w={0.9}
              c="gloss"
              o={0.75}
            />
          </g>
        ))}
        {/* ribs of the grip */}
        {Array.from({ length: 10 }, (_, k) => (
          <g key={k}>
            <Stroke d={`M12 ${CAP_Y + 52 + k * 4}H23`} w={0.9} c="ink" o={0.75} />
            <Stroke d={`M12 ${CAP_Y + 53.4 + k * 4}H21`} w={0.6} c="gloss" o={0.55} />
          </g>
        ))}
        {/* the mouth of the slot */}
        <Brush d="M249.6 245V351" w={2.6} c="w-f-gloss" o={0.35} taper={[0.1, 0.1]} />
        <Stroke bold d={rr(246.5, 239.5, 14, 118, 3.5)} w={1} />
        <Stroke d={rr(252.6, 243, 4.2, 110, 1.6)} w={0.9} />
        <Stroke d="M249 243V353" w={0.7} c="gloss" o={0.8} />
        <Stroke d="M257.6 246V350" w={0.6} c="blue" o={0.6} />
        {[364, 369, 374].map((sy) => (
          <Stroke key={sy} d={`M243 ${sy}H253`} w={0.7} c="soft" o={0.8} />
        ))}
      </g>
      {/* a knurled knob on the grip, turning slowly */}
      <g className="w-turn-slow">
        <Stroke d={gear(17, CAP_Y + 1.5, 3.4, 12, 1.1)} w={0.9} />
        <Stroke d={`M15 ${CAP_Y + 1.5}H19`} w={1} />
        <Stroke
          d={`M14.6 ${CAP_Y - 0.4}Q16 ${CAP_Y - 1.6} 18 ${CAP_Y - 1.2}`}
          w={0.7}
          c="gloss"
          o={0.8}
        />
      </g>
    </g>
  );
}

/** what the CLI printed, typed on the glass */
function TerminalText() {
  const x = TS.x + 9;
  const cursor = x + MONO * 0.6 * 2;
  return (
    <g>
      <g className="font-mono" fontSize={MONO}>
        <text x={x} y={LINE_Y} className="w-f-cream">
          <tspan className="w-f-blue">$</tspan> npx @fumadocs/cli add banner
        </text>
        <text x={x} y={LINE_Y + LINE_STEP} className="w-f-green">
          + components/banner.tsx
        </text>
        <text x={x} y={LINE_Y + LINE_STEP * 2} className="w-f-blue">
          $
        </text>
      </g>
      <g className="w-blink">
        <path
          d={`M${cursor} ${LINE_Y + LINE_STEP * 2 - 8}h${MONO * 0.6}v10h${-MONO * 0.6}Z`}
          className="w-f-cream"
        />
      </g>
    </g>
  );
}

/** the cord between the rack and the terminal: an inked edge and a pale core, with a boot at each end */
function Cord() {
  return (
    <g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(98, 193, 12, 5, 1.6)} c="w-f-deep" />
      </g>
      <g filter="url(#w-wash)">
        <Fill d="M100 197.5H108L106.4 205H101.6Z" c="w-f-sheet" />
        <Fill d="M132.4 221H141.6L143 231H131Z" c="w-f-sheet" />
        <Fill d="M139 221H141.6L143 231H140Z" c="w-f-deep" o={0.18} />
      </g>
      <g filter="url(#w-paint)">
        <Brush d={cordD} w={4.6} taper={[0.02, 0.02]} pressure={0.12} />
        <Brush d={cordD} w={2.2} c="w-f-sheet" taper={[0, 0]} pressure={0.08} />
        <g transform="translate(0.7 0)">
          <Brush d={cordD} w={1} c="w-f-blue" o={0.6} taper={[0.1, 0.1]} />
        </g>
        <g transform="translate(-0.6 0)">
          <Brush d={cordD} w={1.1} c="w-f-gloss" o={0.9} taper={[0.05, 0.4]} pressure={0.35} />
        </g>
        <Stroke d={rr(98, 193, 12, 5, 1.6)} w={0.9} />
        <Stroke d="M100 198H108L106.4 205.4H101.6Z" w={0.9} />
        <Stroke d="M102 201.5H106" w={0.6} c="soft" />
        <Stroke d="M132.4 221H141.6L143 231.2H131Z" w={0.9} />
        <Stroke d="M132.4 224.5H141.8M132 228H142.4" w={0.6} c="soft" />
        <Stroke d="M134 222.5L133.2 230" w={0.7} c="gloss" o={0.7} />
      </g>
    </g>
  );
}

/** the lid of the box, opened back on its hinges: indigo cloth around a paper lining */
const lidOuter = "M303 333L309 266Q309.4 262 313 262H483Q486.6 262 487 266L493 333Z";
const lidInner = "M314 327L318.4 271H477.6L482 327Z";

function BoxLid() {
  return (
    <g>
      <Fill d={lidOuter} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={lidOuter} c="w-f-indigo" o={0.62} />
        <Fill d="M478 264H485Q487 264 487.4 268L493 332H484Z" c="w-f-deep" o={0.3} />
        <Fill d={lidInner} c="w-f-sheet" o={0.95} />
        <Fill d="M315 306H481L482 327H314Z" c="w-f-deep" o={0.2} />
        <Fill d="M440 272H477L481 326H452Z" c="w-f-indigo" o={0.12} />
        <Fill d={rr(366, 278, 64, 21, 2)} c="w-f-cream" o={0.55} />
      </g>
      <g filter="url(#w-paint)">
        <Brush d="M306.6 330L312 266" w={4} c="w-f-gloss" o={0.3} taper={[0.05, 0.1]} />
        <Brush d="M314 266.4H482" w={3.6} c="w-f-indigo" o={0.8} taper={[0.03, 0.03]} />
        <Brush d={lidOuter} w={3} c="w-f-label" loop={2} seed={81} pressure={0.3} />
        <Stroke d={lidOuter} w={1.1} />
        <Stroke d={lidInner} w={0.8} c="soft" />
        <Stroke d="M320 273.4H420" w={0.7} c="gloss" o={0.85} />
        <Stroke d="M305 328L310.6 267" w={0.8} c="gloss" o={0.7} />
        <Stroke d={rr(366, 278, 64, 21, 2)} w={0.8} />
        <Stroke d="M372 285H418M372 290.5H410M372 296H402" w={0.7} c="blue" o={0.8} />
        {[326, 470].map((hx) => (
          <g key={hx}>
            <Stroke d={rr(hx - 7, 329, 14, 5, 1.4)} w={0.9} />
            <Stroke d={`M${hx - 5} 330.6H${hx + 4}`} w={0.6} c="gloss" o={0.8} />
          </g>
        ))}
      </g>
    </g>
  );
}

/** the inside of the card box, its back and side rims, and the index cards standing in it */
function BoxBack() {
  return (
    <g>
      <Fill d={interior} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={interior} c="w-f-indigo" o={0.4} />
        <Fill
          d={`M${BX.bl + 2} ${BX.top + 2}H${BX.br - 2}L${BX.br + 2} ${BX.top + 16}H${BX.bl - 2}Z`}
          c="w-f-deep"
          o={0.3}
        />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          d={`M${BX.bl} ${BX.top}H${BX.br}`}
          w={4.5}
          c="w-f-indigo"
          taper={[0.02, 0.02]}
          pressure={0.15}
        />
        <Brush
          d={`M${BX.bl} ${BX.top}L${BX.l} ${BX.front}`}
          w={4.5}
          c="w-f-indigo"
          o={0.85}
          taper={[0.02, 0]}
        />
        <Brush
          d={`M${BX.br} ${BX.top}L${BX.r} ${BX.front}`}
          w={4.5}
          c="w-f-label"
          o={0.8}
          taper={[0.02, 0]}
        />
        <Stroke
          d={`M${BX.l} ${BX.front}L${BX.bl} ${BX.top}H${BX.br}L${BX.r} ${BX.front}`}
          w={1.1}
        />
        <Stroke d={`M${BX.bl + 4} ${BX.top - 1.4}H${BX.br - 10}`} w={0.8} c="gloss" o={0.8} />
        <Stroke
          d={`M${BX.bl - 2} ${BX.top + 5}L${BX.l + 2} ${BX.front - 4}`}
          w={0.8}
          c="gloss"
          o={0.6}
        />
      </g>

      {dividers.map((d, i) => {
        const tw = d.label.length * 4.8 + 16;
        const outline = `M${d.x0} ${BX.front}V${d.top + 3}Q${d.x0} ${d.top} ${d.x0 + 3} ${d.top}H${d.tab}L${d.tab + 2} ${d.top - 9}Q${d.tab + 2.6} ${d.top - 11} ${d.tab + 5} ${d.top - 11}H${d.tab + tw - 5}Q${d.tab + tw - 2.6} ${d.top - 11} ${d.tab + tw - 2} ${d.top - 9}L${d.tab + tw} ${d.top}H${d.x1 - 3}Q${d.x1} ${d.top} ${d.x1} ${d.top + 3}V${BX.front}`;
        return (
          <g key={d.label}>
            <Fill d={`${outline}Z`} c="w-f-paper" />
            <g filter="url(#w-wash)">
              <Fill d={`${outline}Z`} c="w-f-sheet" o={0.95} />
              {i === 0 && <Fill d={`${outline}Z`} c="w-f-cream" o={0.35} />}
              <Fill
                d={`M${d.x1 - 22} ${d.top + 1}H${d.x1 - 1}V${BX.front}H${d.x1 - 14}Z`}
                c="w-f-indigo"
                o={0.14}
              />
              {/* the rows behind sit deeper in the box */}
              <Fill
                d={`M${d.x0} ${d.top + 14}H${d.x1}V${BX.front}H${d.x0}Z`}
                c="w-f-indigo"
                o={0.16 - i * 0.04}
              />
              <Fill
                d={`M${d.x0} ${d.top + 34}Q${(d.x0 + d.x1) / 2} ${d.top + 28} ${d.x1} ${d.top + 36}V${BX.front}H${d.x0}Z`}
                c="w-f-indigo"
                o={0.12}
              />
              <Fill d={rr(d.tab + 3, d.top - 9, tw - 6, 8, 2)} c="w-f-blue" o={0.25} />
            </g>
            <g filter="url(#w-paint)">
              <Stroke d={outline} w={1} />
              <Stroke
                d={`M${d.x0 + 4} ${d.top + 1.6}H${d.tab - 2}M${d.tab + 4} ${d.top - 9.6}H${d.tab + tw - 6}`}
                w={0.7}
                c="gloss"
                o={0.9}
              />
              <Stroke d={`M${d.x0 + 6} ${d.top + 7}H${d.x1 - 6}`} w={0.7} c="blue" o={0.7} />
              <Stroke d={`M${d.x1 - 1.6} ${d.top + 4}V${d.top + 20}`} w={1.2} c="blue" o={0.5} />
              <Brush
                d={`M${d.x0 + 3} ${d.top + 4}V${d.top + 24}`}
                w={2.4}
                c="w-f-gloss"
                o={0.7}
                taper={[0.1, 0.5]}
              />
              {i === dividers.length - 1 && (
                <Stroke
                  d={rules(d.x0 + 6, d.top + 14, 7, [170, 170, 170, 170, 170, 170, 170])}
                  w={0.6}
                  c="blue"
                  o={0.4}
                />
              )}
              <Brush
                d={`M${d.x0 + 30 + i * 40} ${d.top + 12}H${d.x0 + 80 + i * 40}`}
                w={5}
                c="w-f-blue"
                o={0.16}
                taper={[0.4, 0.4]}
              />
            </g>
            <text
              x={d.tab + tw / 2}
              y={d.top - 2.4}
              fontSize={8}
              textAnchor="middle"
              className="w-f-text font-mono"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** the slide from the slot of the terminal over the rim of the box: a bed of rollers between two rails */
function Chute() {
  const along = (t: number, dy: number) => [250 + 74 * t, 338 + 24.7 * t + dy] as const;
  return (
    <g>
      <Fill d={`${chuteTop}${chuteLip}`} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={chuteTop} c="w-f-indigo" o={0.42} />
        <Fill d="M250 338L324 362.7L324 366.7L250 342Z" c="w-f-deep" o={0.3} />
        <Fill d={chuteLip} c="w-f-indigo" o={0.75} />
        <Fill d="M250 357L324 381.7L324 383.7L250 359Z" c="w-f-deep" o={0.4} />
      </g>
      <g filter="url(#w-paint)">
        {/* rollers across the bed */}
        {[0.16, 0.34, 0.52, 0.7, 0.88].map((t) => {
          const [ax, ay] = along(t, 3);
          const [bx, by] = along(t, 13.5);
          return (
            <g key={t}>
              <Brush
                d={`M${ax} ${ay}L${bx} ${by}`}
                w={3}
                c="w-f-sheet"
                o={0.9}
                taper={[0.1, 0.1]}
                pressure={0.15}
              />
              <Stroke d={`M${ax + 1.6} ${ay + 0.4}L${bx + 1.6} ${by + 0.4}`} w={0.8} />
              <Stroke
                d={`M${ax - 0.6} ${ay + 0.6}L${bx - 0.6} ${by - 0.6}`}
                w={0.6}
                c="gloss"
                o={0.9}
              />
            </g>
          );
        })}
        <Brush d="M252 355.4L322 378.8" w={2.4} c="w-f-gloss" o={0.35} taper={[0.1, 0.3]} />
        <Stroke d="M250 338L324 362.7" w={1.1} />
        <Stroke d="M250 341.4L324 366.1" w={0.6} c="gloss" o={0.6} />
        <Stroke d="M250 353L324 377.7L324 383.7" w={1.1} />
        <Stroke d="M250 359L324 383.7" w={1} />
        <Stroke d="M252 354.6L322 378" w={0.7} c="gloss" o={0.75} />
        <Stroke d="M324 362.7V377.7" w={1} />
      </g>
    </g>
  );
}

/** the component the CLI printed: a slip with its file name on a tab and its source etched on it */
function NewCard() {
  const { x, y, w, h } = CARD;
  const tw = 64;
  const outline = `M${x} ${y + h}V${y + 3}Q${x} ${y} ${x + 3} ${y}H${x + 4}L${x + 5} ${y - 9}Q${x + 5.6} ${y - 12} ${x + 9} ${y - 12}H${x + tw - 4}Q${x + tw - 1} ${y - 12} ${x + tw} ${y - 9}L${x + tw + 1} ${y}H${x + w - 3}Q${x + w} ${y} ${x + w} ${y + 3}V${y + h}Z`;
  /** etched code: lengths and paints of the rules on each row, from an indent */
  const rows: [number, [number, "ink" | "indigo" | "soft"][]][] = [
    [
      0,
      [
        [14, "indigo"],
        [24, "ink"],
      ],
    ],
    [
      4,
      [
        [10, "indigo"],
        [18, "ink"],
        [8, "soft"],
      ],
    ],
    [
      8,
      [
        [22, "ink"],
        [12, "indigo"],
      ],
    ],
    [8, [[30, "soft"]]],
    [
      4,
      [
        [16, "indigo"],
        [20, "ink"],
      ],
    ],
    [8, [[26, "ink"]]],
    [4, [[6, "soft"]]],
    [0, [[4, "soft"]]],
    [
      0,
      [
        [18, "indigo"],
        [16, "ink"],
      ],
    ],
    [4, [[28, "ink"]]],
    [0, [[4, "soft"]]],
  ];
  return (
    <g transform={`rotate(-4 ${x + w / 2} ${y + h})`}>
      <path d={outline} transform="translate(5 4)" className="w-f-shadow-glaze" />
      <Fill d={outline} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={outline} c="w-f-sheet" />
        <Fill
          d={`M${x + w - 14} ${y + 1}H${x + w - 1}V${y + h - 1}H${x + w - 8}Z`}
          c="w-f-indigo"
          o={0.12}
        />
        <Fill d={rr(x + w - 17, y + 4, 12, 6, 3)} c="w-f-green" o={0.85} />
      </g>
      <g filter="url(#w-ink)">
        {rows.map(([indent, marks], k) => {
          let cx = x + 6 + indent;
          return marks.map(([len, c], m) => {
            const d = `M${cx} ${y + 15 + k * 6.6}H${cx + len}`;
            cx += len + 3;
            return (
              <Stroke
                key={`${k}-${m}`}
                d={d}
                w={c === "soft" ? 0.8 : 1}
                c={c}
                o={c === "soft" ? 0.7 : 0.9}
              />
            );
          });
        })}
      </g>
      <g filter="url(#w-paint)">
        <Stroke bold d={outline} w={1} />
        <Stroke
          d={`M${x + 3} ${y + 1.6}H${x + 3.6}M${x + 8} ${y - 10.4}H${x + tw - 6}M${x + tw + 3} ${y + 1.6}H${x + w - 6}`}
          w={0.7}
          c="gloss"
          o={0.9}
        />
        <Stroke d={`M${x + w - 1.6} ${y + 4}V${y + h - 4}`} w={1.2} c="blue" o={0.5} />
      </g>
      <text
        x={x + (tw + 5) / 2}
        y={y - 3}
        fontSize={8}
        textAnchor="middle"
        className="w-f-text font-mono"
      >
        banner.tsx
      </text>
    </g>
  );
}

/** the front wall of the box, in book cloth, with metal corners, a label and a pull */
function BoxFront() {
  const { l, r, front: t, foot } = BX;
  const lx = (l + r) / 2;
  return (
    <g>
      <Fill d={rr(l - 1, t - 1, r - l + 2, foot - t + 2, 4)} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={rr(l - 2, t - 2, r - l + 4, foot - t + 4, 5)} c="w-f-indigo" o={0.66} />
        <Fill
          d={`M${l + 4} ${t + 6}Q${l + 60} ${t + 3} ${l + 110} ${t + 6}Q${l + 50} ${t + 12} ${l + 10} ${t + 26}Z`}
          c="w-f-gloss"
          o={0.14}
        />
        <Fill d={`M${l} ${foot - 12}H${r}V${foot}H${l}Z`} c="w-f-deep" o={0.28} />
        <Fill d={`M${r - 14} ${t}H${r + 1}V${foot}H${r - 8}Z`} c="w-f-deep" o={0.26} />
        <Fill d={`M${l} ${t - 1.5}H${r}V${t + 3.5}H${l}Z`} c="w-f-sheet" o={0.85} />
        <Fill d={rr(lx - 39, t + 12, 84, 20, 3)} c="w-f-deep" o={0.3} />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          d={`M${l + 6} ${t + 8}H${r - 6}`}
          w={5}
          c="w-f-indigo"
          taper={[0.03, 0.03]}
          pressure={0.15}
        />
        <Brush
          d={`M${l + 10} ${t + 9}H${l + 120}`}
          w={2.6}
          c="w-f-gloss"
          o={0.3}
          taper={[0.05, 0.2]}
        />
        <Brush
          d={`M${l + 6} ${foot - 5}H${r - 6}`}
          w={5}
          c="w-f-label"
          o={0.6}
          taper={[0.03, 0.03]}
        />
        <Brush
          d={`M${l + 20} ${foot - 12}H${l + 90}`}
          w={4}
          c="w-f-blue"
          o={0.22}
          taper={[0.4, 0.4]}
        />
        <Brush d={`M${r - 90} ${t + 20}V${t + 30}`} w={4} c="w-f-deep" o={0.2} taper={[0.3, 0.3]} />
        <Brush
          d={`M${r - 4} ${t + 4}V${foot - 4}`}
          w={4}
          c="w-f-label"
          o={0.6}
          taper={[0.05, 0.05]}
        />
        {/* the rim, in two passes */}
        <Brush
          d={rr(l - 2, t - 2, r - l + 4, foot - t + 4, 5)}
          w={3.4}
          c="w-f-label"
          loop={3}
          seed={71}
          pressure={0.35}
        />
        <Brush
          d={rr(l - 1.4, t - 1.4, r - l + 2.8, foot - t + 2.8, 4.5)}
          w={1.6}
          c="w-f-ink"
          o={0.9}
          loop={3}
          seed={73}
        />
        <Stroke d={`M${l + 2} ${t + 3.8}H${r - 2}`} w={0.9} />
        <Stroke d={`M${l + 4} ${t - 0.4}H${r - 30}`} w={0.8} c="gloss" o={0.85} />
        <Stroke
          d={`M${l + 1} ${t + 6}Q${l} ${t + 24} ${l + 1} ${foot - 4}`}
          w={1}
          c="gloss"
          o={0.7}
        />
        <Stroke d={`M${l + 8} ${foot - 2.4}H${r - 8}`} w={1.8} c="blue" o={0.45} />
        {/* metal corners */}
        {[
          `M${l - 2} ${t + 12}V${t + 1}Q${l - 2} ${t - 2} ${l + 1} ${t - 2}H${l + 12}`,
          `M${r - 12} ${t - 2}H${r - 1}Q${r + 2} ${t - 2} ${r + 2} ${t + 1}V${t + 12}`,
          `M${l - 2} ${foot - 12}V${foot - 1}Q${l - 2} ${foot + 2} ${l + 1} ${foot + 2}H${l + 12}`,
          `M${r - 12} ${foot + 2}H${r - 1}Q${r + 2} ${foot + 2} ${r + 2} ${foot - 1}V${foot - 12}`,
        ].map((d) => (
          <Brush key={d} d={d} w={3.6} c="w-f-sheet" o={0.9} taper={[0.1, 0.1]} pressure={0.2} />
        ))}
        {[
          [l + 4, t + 4],
          [r - 4, t + 4],
          [l + 4, foot - 4],
          [r - 4, foot - 4],
        ].map(([cx = 0, cy = 0]) => (
          <Stroke key={`${cx}-${cy}`} d={ring(cx, cy, 1.2)} w={0.8} />
        ))}
        {/* the pull */}
        <Stroke d={`M${lx - 9} ${t + 37}Q${lx + 3} ${t + 46} ${lx + 15} ${t + 37}`} w={1.6} />
        <Stroke
          d={`M${lx - 6} ${t + 39.6}Q${lx + 3} ${t + 45} ${lx + 10} ${t + 40.4}`}
          w={0.7}
          c="gloss"
          o={0.8}
        />
        <Stroke d={`${ring(lx - 10, t + 36.4, 1.5)}${ring(lx + 16, t + 36.4, 1.5)}`} w={0.8} />
      </g>
      {/* the label holder */}
      <g filter="url(#w-wash)">
        <Fill d={rr(lx - 42, t + 9, 84, 20, 3)} c="w-f-sheet" o={0.97} />
        <Fill
          d={`M${lx + 38} ${t + 10}Q${lx + 41} ${t + 10} ${lx + 41} ${t + 13}V${t + 25}Q${lx + 41} ${t + 28} ${lx + 38} ${t + 28}H${lx - 38}Q${lx + 36} ${t + 26} ${lx + 38} ${t + 10}Z`}
          c="w-f-shadow"
          o={0.7}
        />
      </g>
      <g filter="url(#w-paint)">
        <Stroke bold d={rr(lx - 42, t + 9, 84, 20, 3)} w={1} />
        <Stroke d={`M${lx - 39} ${t + 11.4}H${lx + 24}`} w={0.7} c="gloss" o={0.9} />
      </g>
      <text x={lx} y={t + 22.8} fontSize={11} textAnchor="middle" className="w-f-text w-serif">
        your project
      </text>
    </g>
  );
}

export function LayoutsFigure() {
  const top = LIP - 12; // back edge of the top face
  return (
    <svg
      viewBox="0 0 520 440"
      className="block w-full overflow-visible"
      role="img"
      aria-label="Three etched glass plates slide into a rack, each a desktop screen of the Docs, Notebook or Home layout; the Notebook plate is lifted. Below, a terminal corded to the rack runs npx @fumadocs/cli add banner and prints components/banner.tsx on a card, which slides down a chute into the card box of your project, beside its app, content and lib cards"
    >
      {/* 1. flat shadows on the paper, down and right of each part */}
      <g filter="url(#w-flat)">
        {plates.map((p) => (
          <Motion key={p.kind} kind={p.kind}>
            <path d={cast(rr(p.x, p.y, W, LIP - p.y - 4, 8), 18, 12)} className="w-f-shadow" />
          </Motion>
        ))}
        <path d={cast(rr(8, top, 500, 64, 9), 20, 13)} className="w-f-shadow" />
        <path d={cast(rr(14, TB.y, 234, TB.h + 2, 9), 20, 14)} className="w-f-shadow" />
        <path d={cast("M250 338L325 363L325 384L250 359Z", 10, 10)} className="w-f-shadow" />
        <path
          d={cast(
            `M${BX.bl} ${BX.top}H${BX.br}L${BX.r} ${BX.front}V${BX.foot}H${BX.l}V${BX.front}Z`,
            18,
            12,
          )}
          className="w-f-shadow"
        />
        <path d={cast("M306 262H484L493 333H300Z", 16, 10)} className="w-f-shadow" />
        <g transform="translate(9 6)">
          <Brush d={cordD} w={4} c="w-f-shadow" taper={[0.02, 0.02]} />
        </g>
      </g>

      {/* 2. the back of the rack: the top face with its slots */}
      <Fill d={`M14 ${top + 1}H504L508 ${LIP + 1}H10Z`} c="w-f-paper" />
      <g filter="url(#w-wash)">
        <Fill d={`M12 ${top}H506L512 ${LIP + 2}H6Z`} c="w-f-indigo" o={0.5} />
        <Fill d={`M10 ${top + 8}H508L512 ${LIP + 2}H6Z`} c="w-f-deep" o={0.18} />
      </g>
      <g filter="url(#w-wash-dense)">
        {plates.map((p) => (
          <Fill key={p.kind} d={rr(p.x - 3, LIP - 6, W + 6, 5, 2)} c="w-f-deep" />
        ))}
      </g>
      <g filter="url(#w-paint)">
        <Stroke bold d={`M12 ${top}H506L512 ${LIP + 2}H6Z`} w={1.2} />
        <Stroke d={`M16 ${top + 2.6}H502`} w={0.9} c="gloss" o={0.75} />
        {plates.map((p) => (
          <Stroke key={p.kind} d={rr(p.x - 3, LIP - 6, W + 6, 5, 2)} w={0.8} />
        ))}
      </g>

      {plates.map((p, i) => (
        <Motion key={p.kind} kind={p.kind}>
          <PlateBody {...p} i={i} />
        </Motion>
      ))}

      {/* 3. the front of the rack */}
      <Fill
        d={`${rr(7, F + 1, 506, 47, 6)}${rr(7, F - 4, 20, 52, 5)}${rr(493, F - 4, 20, 52, 5)}`}
        c="w-f-paper"
      />
      <g filter="url(#w-wash)">
        <Fill d={`M6 ${F}H514V${F + 4}H6Z`} c="w-f-indigo" o={0.6} />
        <Fill d={rr(6, F + 3, 508, 46, 7)} c="w-f-indigo" o={0.66} />
        <Fill
          d={`M40 ${F + 9}Q140 ${F + 6} 250 ${F + 9}Q160 ${F + 15} 60 ${F + 25}Z`}
          c="w-f-gloss"
          o={0.12}
        />
        <Fill
          d={`M10 ${F + 37}H510Q514 ${F + 37} 514 ${F + 41}V${F + 42}Q514 ${F + 49} 507 ${F + 49}H13Q6 ${F + 49} 6 ${F + 42}V${F + 41}Q6 ${F + 37} 10 ${F + 37}Z`}
          c="w-f-deep"
          o={0.3}
        />
        <Fill d={`M10 ${F + 4}H510V${F + 8}H10Z`} c="w-f-deep" o={0.28} />
        {capX.map((ex) => (
          <Fill key={ex} d={rr(ex, F - 5, 22, 54, 6)} c="w-f-indigo" o={0.5} />
        ))}
        {capX.map((ex) => (
          <Fill key={ex} d={`M${ex + 16} ${F - 3}h6v50h-6Z`} c="w-f-deep" o={0.25} />
        ))}
        <Fill d={rr(40, F + 48, 34, 7, 2)} c="w-f-deep" o={0.8} />
        <Fill d={rr(446, F + 48, 34, 7, 2)} c="w-f-deep" o={0.8} />
      </g>
      <g filter="url(#w-wash-dense)">
        {vents.map((vx) => (
          <Fill key={vx} d={rr(vx, F + 15, 3, 21, 1.5)} c="w-f-deep" />
        ))}
        <Fill d={ring(lamp, F + 25.5, 5.6)} c="w-f-deep" />
      </g>

      <g filter="url(#w-paint)">
        {/* masses of the front: a lit upper band, a darker foot, broken patches */}
        <Brush
          d={`M14 ${F + 11.5}H506`}
          w={5}
          c="w-f-indigo"
          taper={[0.03, 0.03]}
          pressure={0.15}
        />
        <Brush d={`M18 ${F + 12.5}H490`} w={2.6} c="w-f-gloss" o={0.3} taper={[0.05, 0.1]} />
        <Brush
          d={`M14 ${F + 41}H506`}
          w={6}
          c="w-f-gloss"
          o={0.22}
          taper={[0.04, 0.06]}
          pressure={0.2}
        />
        <Brush d={`M14 ${F + 45}H506`} w={5} c="w-f-label" o={0.65} taper={[0.03, 0.03]} />
        <Brush d={`M60 ${F + 12}H180`} w={4} c="w-f-blue" o={0.25} taper={[0.4, 0.4]} />
        <Brush d={`M300 ${F + 44}H420`} w={4} c="w-f-deep" o={0.25} taper={[0.4, 0.4]} />
        <Brush d={`M150 ${F + 26}V${F + 34}`} w={4} c="w-f-gloss" o={0.25} taper={[0.3, 0.3]} />
        {/* the rim, in two passes */}
        <Brush d={rr(6, F, 508, 49, 7)} w={3.6} c="w-f-label" loop={3} seed={51} pressure={0.35} />
        <Brush
          d={rr(6.6, F + 0.6, 506.8, 47.8, 6.5)}
          w={1.7}
          c="w-f-ink"
          o={0.9}
          loop={3}
          seed={53}
        />
        <Stroke d={`M10 ${F + 3.6}H510`} w={1.6} c="cream" o={0.8} />
        <Stroke d={`M12 ${F + 1.4}H508`} w={0.8} c="gloss" o={0.85} />
        <Stroke d={`M10 ${F + 8.5}H510`} w={0.8} />
        <Stroke d={`M14 ${F + 46.4}H506`} w={2.2} c="blue" o={0.5} />
        <Stroke d={`M36 ${F + 41}H200M250 ${F + 42}H420`} w={0.8} c="gloss" o={0.45} />

        {/* end caps with ribbed grips */}
        {capX.map((ex) => (
          <g key={ex}>
            <Brush
              d={`M${ex + 5} ${F}V${F + 44}`}
              w={5}
              c="w-f-gloss"
              o={0.3}
              taper={[0.05, 0.05]}
            />
            <Brush
              d={`M${ex + 18} ${F - 1}V${F + 46}`}
              w={5}
              c="w-f-label"
              o={0.6}
              taper={[0.05, 0.05]}
            />
            <Brush d={rr(ex, F - 5, 22, 54, 6)} w={2.8} c="w-f-label" loop={2} seed={ex + 1} />
            <Stroke bold d={rr(ex, F - 5, 22, 54, 6)} w={1.2} />
            {Array.from({ length: 9 }, (_, k) => (
              <g key={k}>
                <Stroke d={`M${ex + 4} ${F + 9 + k * 4}H${ex + 18}`} w={0.9} c="ink" o={0.75} />
                <Stroke
                  d={`M${ex + 4} ${F + 10.4 + k * 4}H${ex + 16}`}
                  w={0.6}
                  c="gloss"
                  o={0.55}
                />
              </g>
            ))}
            <Stroke
              d={`M${ex + 3} ${F - 1}Q${ex + 2} ${F + 19} ${ex + 3} ${F + 41}`}
              w={0.9}
              c="gloss"
              o={0.75}
            />
            {/* a knurled knob, turning slowly */}
            <g className="w-turn-slow">
              <Stroke d={gear(ex + 11, F + 1.5, 3.4, 12, 1.1)} w={0.9} />
              <Stroke d={`M${ex + 9} ${F + 1.5}H${ex + 13}`} w={1} />
              <Stroke
                d={`M${ex + 8.6} ${F - 0.4}Q${ex + 10} ${F - 1.6} ${ex + 12} ${F - 1.2}`}
                w={0.7}
                c="gloss"
                o={0.8}
              />
            </g>
          </g>
        ))}

        {/* vents */}
        {vents.map((vx) => (
          <Stroke key={vx} d={`M${vx + 3.4} ${F + 16}V${F + 36}`} w={0.6} c="blue" o={0.6} />
        ))}

        {/* feet */}
        <Stroke d={`${rr(40, F + 48, 34, 7, 2)}${rr(446, F + 48, 34, 7, 2)}`} w={1.1} />
        {[48, 66, 454, 472].map((fx) => (
          <Stroke key={fx} d={ring(fx, F + 51.5, 1.4)} w={0.6} c="gloss" o={0.6} />
        ))}
      </g>

      {plates.map((p, i) => (
        <Plaque key={p.kind} kind={p.kind} cx={plaques[i]!} />
      ))}

      {/* the lamp of the lifted plate lights once it is up */}
      <g data-key="notebook">
        <g className="w-light" style={at(1)}>
          <g filter="url(#w-wash)" className="w-breathe">
            <Fill d={ring(lamp, F + 25.5, 4)} c="w-f-green" />
          </g>
          <g filter="url(#w-paint)">
            <Brush
              pts={ptsOfCircle(lamp, F + 25.5, 2.6, Math.PI * 1.1, Math.PI * 1.6)}
              w={1.2}
              c="w-f-gloss"
              o={0.9}
              taper={[0.2, 0.5]}
            />
          </g>
        </g>
        <g filter="url(#w-paint)">
          <Stroke d={ring(lamp, F + 25.5, 5.6)} w={1} />
        </g>
      </g>

      {/* 4. the workbench: the box, the chute, the printed card behind the terminal, the front of the box */}
      <BoxLid />
      <BoxBack />
      <Chute />
      <g className="w-slide-card">
        <NewCard />
      </g>
      <TerminalBody />
      <TerminalCaps />
      <TerminalText />
      <Cord />
      <BoxFront />
    </svg>
  );
}
