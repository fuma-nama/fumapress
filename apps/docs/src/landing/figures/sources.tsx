import type { CSSProperties } from "react";
import {
  Brush,
  Fill,
  VerticalText,
  gear,
  ptsOfCircle,
  rr,
  cast,
  Stroke,
  ring,
  type Paint,
} from "../pen";

/* figure: content sources, each plugged into one site under its own path */

type Pt = readonly [number, number];

const poly = (...pts: Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
const path = (...pts: Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}`;

/** a dab of paint */
function Dot({
  x,
  y,
  r = 0.6,
  c = "gloss",
  o,
}: {
  x: number;
  y: number;
  r?: number;
  c?: Paint;
  o?: number;
}) {
  return <Brush pts={ptsOfCircle(x, y, r / 2)} w={r} c={c} o={o} />;
}

/** `label`: where the name is centered, left of the plug on Sanity's monitor */
const sources = [
  { x: 64, label: 64, key: "mdx", name: "MDX files", path: "/docs" },
  { x: 192, label: 192, key: "notion", name: "Notion", path: "/guides" },
  { x: 320, label: 320, key: "obsidian", name: "Obsidian", path: "/notes" },
  { x: 448, label: 432, key: "sanity", name: "Sanity", path: "/blog" },
] as const;

/** where cords leave the sources and where they enter the plugs of the site */
const cordTop = 190;
const cordEnd = 276;

function bezier([p0, p1, p2, p3]: readonly [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

const cords = sources.map((s, i) => {
  const jx = 164 + i * 64;
  const pts: readonly [Pt, Pt, Pt, Pt] = [
    [s.x, cordTop],
    [s.x, 238],
    [jx, 226],
    [jx, cordEnd],
  ];
  let len = 0;
  for (let k = 1; k <= 40; k++) {
    const a = bezier(pts, (k - 1) / 40);
    const b = bezier(pts, k / 40);
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return {
    jx,
    key: s.key,
    pts,
    len,
    d: `M${s.x} ${cordTop}C${s.x} 238 ${jx} 226 ${jx} ${cordEnd}`,
  };
});

/**
 * Slips leave once the sources have settled. `InView` starts them at `data-delay + 0.3s`, so each
 * arrives at `i * 0.3s + 1.6s`, when the `w-light` lamp and path of its socket light up. Then
 * they repeat after a quiet pause.
 */
const slipDur = 1;
/** after the first trip, a slip runs every `slipCycle` seconds */
const slipCycle = 7;
const slipTravel = +(slipDur / slipCycle).toFixed(4);
const slipDelay = (i: number) => 0.3 + i * 0.3;

/** the outline of a cord of width `w`, so it can be filled like paint */
function ribbon(pts: readonly [Pt, Pt, Pt, Pt], w: number) {
  const [p0, p1, p2, p3] = pts;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const [x, y] = bezier(pts, t);
    const dx =
      3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy =
      3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2);
    const ny = (dx / len) * (w / 2);
    left.push([+(x + nx).toFixed(2), +(y + ny).toFixed(2)]);
    right.push([+(x - nx).toFixed(2), +(y - ny).toFixed(2)]);
  }
  return poly(...left, ...right.reverse());
}

/** slotted screw head */
function Screw({ x, y, r = 4.5, a = -0.6 }: { x: number; y: number; r?: number; a?: number }) {
  const c = Math.cos(a) * (r - 1.2);
  const s = Math.sin(a) * (r - 1.2);
  return (
    <>
      <Dot x={x} y={y} r={r} c="deep" o={0.7} />
      <Stroke d={ring(x, y, r)} w={1.1} />
      <Brush pts={ptsOfCircle(x, y, r + 1.6, 0.2, 1.9)} w={1.6} c="label" o={0.6} />
      <Stroke
        d={`M${(x - c).toFixed(1)} ${(y - s).toFixed(1)}L${(x + c).toFixed(1)} ${(y + s).toFixed(1)}`}
        w={1}
        c="gloss"
        o={0.7}
        taper={[0.2, 0.2]}
      />
      <Stroke
        d={`M${x - r * 0.55} ${y - r * 0.35}Q${x - r * 0.3} ${y - r * 0.75} ${x + r * 0.1} ${y - r * 0.8}`}
        w={0.7}
        c="gloss"
        o={0.8}
      />
    </>
  );
}

function Rivet({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Dot x={x} y={y} r={1.6} c="deep" o={0.85} />
      <Dot x={x - 0.5} y={y - 0.5} r={0.6} />
    </>
  );
}

/** the strain relief where a cord leaves a source, from `y0` down to the cord */
function Boot({ y0 }: { y0: number }) {
  const y1 = cordTop + 1;
  const rings = [0.25, 0.5, 0.75].map((f) => y0 + 6 + (y1 - y0 - 6) * f);
  return (
    <>
      <g filter="url(#w-flat)">
        <Fill d={poly([3, y0 + 5], [17, y0 + 5], [15, y1 + 6], [7, y1 + 6])} c="shadow" />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(-7.5, y0, 15, 6.5, 1.6)} c="deep" />
      </g>
      <g filter="url(#w-wash)">
        <Fill d={poly([-5.6, y0 + 6], [5.6, y0 + 6], [3, y1], [-3, y1])} c="sheet" />
        <Fill d={poly([2, y0 + 6], [5.6, y0 + 6], [3, y1], [1, y1])} c="deep" o={0.16} />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          d={`M2.6 ${y0 + 8}L1.6 ${y1 - 1}`}
          w={2.6}
          c="blue-light"
          o={0.4}
          taper={[0.2, 0.2]}
        />
        <Stroke d={rr(-7.5, y0, 15, 6.5, 1.6)} w={1} />
        <Stroke d={`M-5.5 ${y0 + 1.6}H2`} w={0.8} c="gloss" o={0.75} />
        <Stroke d={`M-4 ${y0 + 4.6}H6`} w={0.9} c="blue-light" o={0.5} />
        <Stroke d={poly([-5.6, y0 + 6.5], [5.6, y0 + 6.5], [3, y1], [-3, y1])} w={1} />
        {rings.map((y, k) => {
          const hw = 5.6 - (2.6 * (y - y0 - 6)) / (y1 - y0 - 6);
          return (
            <Stroke
              key={k}
              d={`M${(-hw).toFixed(1)} ${y.toFixed(1)}H${hw.toFixed(1)}`}
              w={0.65}
              c="ink-soft"
            />
          );
        })}
        <Stroke d={`M-3.8 ${y0 + 8}L-2.4 ${y1 - 1.5}`} w={0.7} c="gloss" o={0.7} />
      </g>
    </>
  );
}

/* MDX: a stack of manuscript sheets in a binder clip */

function Manuscript() {
  const top = poly([-35, 70], [35, 70], [36, 154], [22, 168.4], [-34, 169]);
  return (
    <>
      <g filter="url(#w-flat)">
        <Fill d={cast(poly([-35, 70], [41, 64], [45, 168], [-31, 172]), 14, 13)} c="shadow" />
      </g>

      {/* the back handle of the clip, folded behind */}
      <g filter="url(#w-paint)">
        <Stroke
          d="M-14 70L-13 51Q-13 46.5 -8.5 46.5H8.5Q13 46.5 13 51L14 70"
          w={1.3}
          c="ink-soft"
        />
      </g>

      <g filter="url(#w-wash)">
        <Fill d={poly([-31, 72], [37, 68], [42, 166], [-26, 170])} c="sheet" />
        <Fill d={poly([-31, 72], [37, 68], [42, 166], [-26, 170])} c="deep" o={0.09} />
        <Fill d={poly([-40, 76], [29, 74], [31, 172], [-38, 174])} c="sheet" />
        <Fill d={poly([-40, 76], [29, 74], [31, 172], [-38, 174])} c="deep" o={0.05} />
        <Fill d={top} c="sheet" />
      </g>
      {/* form shadows on the top sheet, the clip's shadow, and under the dog-ear */}
      <g filter="url(#w-wash)">
        <Fill d={poly([29, 72], [35, 70], [36, 154], [30, 159])} c="deep" o={0.08} />
        <Fill d={poly([-34, 163], [27, 163], [22, 168.4], [-34, 169])} c="deep" o={0.07} />
        <Fill d={poly([-15, 86], [22, 86], [25, 97], [-11, 97])} c="deep" o={0.2} />
        <Fill d={poly([36, 155], [23, 168.4], [28, 162])} c="deep" o={0.22} />
        <Fill d={rr(-29, 128, 56, 20, 2)} c="indigo-wash" o={0.16} />
        <Fill d={poly([4, 113.2], [20, 112.6], [20.5, 118.2], [4.5, 118.8])} c="green" o={0.5} />
        <Fill d={poly([36, 154], [22, 168.4], [24.5, 156.5])} c="sheet" />
      </g>

      <g filter="url(#w-paint)">
        {/* cool shade where the top sheet lifts off the stack, light on its upper edge */}
        <Brush d="M32 76L33 150" w={5} c="blue-light" o={0.3} taper={[0.15, 0.3]} pressure={0.3} />
        <Brush d="M-30 165H18" w={4} c="blue-light" o={0.3} taper={[0.2, 0.3]} />
        <Brush d="M-31 80Q-32 120 -30 160" w={4} c="gloss" o={0.6} taper={[0.2, 0.4]} />
        <Brush d="M-36 172H26" w={3} c="ink-soft" o={0.18} taper={[0.2, 0.2]} />
        {/* sheet edges, back to front */}
        <Stroke bold d={poly([-31, 72], [37, 68], [42, 166], [-26, 170])} w={0.9} c="ink-soft" />
        <Stroke d={poly([-40, 76], [29, 74], [31, 172], [-38, 174])} w={0.9} c="ink-soft" />
        <Stroke d="M-33 171.2L21 170.8M-32 172.8L19 172.4" w={0.55} c="ink-soft" o={0.8} />
        <Stroke d="M37.6 73L38.4 152M39 75L39.8 150" w={0.55} c="ink-soft" o={0.8} />
        <Stroke d="M-30 168.2H20" w={1.6} c="blue-light" o={0.4} />
        <Stroke bold d={top} w={1.3} />
        <Stroke d={poly([36, 154], [22, 168.4], [24.5, 156.5])} w={0.9} />
        <Stroke d="M33.5 155.5L25.5 156.6" w={0.7} c="gloss" o={0.9} />
        <Stroke d="M-32.5 72.5H-20" w={1.2} c="gloss" o={0.9} />

        {/* the writing: a heading, paragraphs and a component */}
        <Stroke d="M-31 74V166" w={0.6} c="blue-light" o={0.7} />
        <Stroke d="M-25.5 95L-27 104M-21.5 95L-23 104M-28 97.8H-20M-28.6 101.2H-20.6" w={0.9} />
        <Stroke d="M-16 99.5H16" w={1.7} taper={[0.04, 0.2]} pressure={0.1} />
        <Stroke d="M-26 110H26M-26 116H20M-26 122H24" w={0.9} c="ink-soft" o={0.8} />
        <Stroke d={rr(-29, 128, 56, 20, 2)} w={0.7} c="ink-soft" />
        <Stroke d="M-22 134L-25.5 138L-22 142M3 142L6 134M9.5 134L13 138L9.5 142" w={1} />
        <Stroke
          d="M-18 138H-1"
          w={1.4}
          c="green-deep"
          o={0.85}
          taper={[0.05, 0.2]}
          pressure={0.1}
        />
        <Stroke d="M-18 143.5H-6" w={0.7} c="blue-light" o={0.8} />
        <Stroke d="M-26 154H18M-26 160H8" w={0.9} c="ink-soft" o={0.8} />
      </g>

      {/* the binder clip */}
      <g filter="url(#w-wash-dense)">
        <Fill d={poly([-15, 64], [15, 64], [19.5, 84], [-19.5, 84])} c="deep" />
      </g>
      <g filter="url(#w-wash)">
        <Fill d={poly([-15, 64], [-2, 64], [-6, 84], [-19.5, 84])} c="indigo-wash" o={0.4} />
        <Fill d={rr(-21, 82, 42, 6, 3)} c="ink-soft" o={0.85} />
      </g>
      <g filter="url(#w-paint)">
        <Brush d="M-9 67L-12.5 81" w={6} c="indigo-wash" o={0.6} taper={[0.15, 0.15]} />
        <Brush d="M10 67L13 81" w={5} c="label" o={0.8} taper={[0.15, 0.15]} />
        <Stroke bold d={poly([-15, 64], [15, 64], [19.5, 84], [-19.5, 84])} w={1.3} />
        <Stroke d={rr(-21, 82, 42, 6, 3)} w={1.1} />
        <Stroke d="M-18 84H12" w={0.8} c="gloss" o={0.85} />
        <Stroke d="M-12.8 66.5L-16.2 80" w={1} c="gloss" o={0.85} />
        <Stroke d="M14.6 67L17.6 81" w={1.8} c="blue-light" o={0.55} />
        <Stroke d="M-10 68.5L-6 68.2" w={1.6} c="gloss" o={0.8} />
        <Stroke d="M-14 83.5V86.5M14 83.5V86.5" w={2.2} />
        {/* the front handle, folded up over the plate */}
        <Stroke d="M-13 85L-10.5 55Q-10.3 50.5 -5.5 50.5H5.5Q10.3 50.5 10.5 55L13 85" w={1.5} />
        <Stroke d="M-11.6 82L-9.4 56Q-9.2 52 -5 52" w={0.6} c="gloss" o={0.9} />
      </g>

      <Boot y0={169} />
    </>
  );
}

/* Notion: a card cabinet with its top drawer pulled out */

function DrawerFront({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const c = x + w / 2;
  return (
    <>
      <g filter="url(#w-wash)">
        <Fill d={rr(x, y, w, h, 2)} c="indigo-wash" o={0.6} />
        <Fill
          d={poly([x, y + h - 5], [x + w, y + h - 6], [x + w, y + h], [x, y + h])}
          c="deep"
          o={0.25}
        />
        <Fill
          d={poly([x + w - 4, y + 2], [x + w, y + 2], [x + w, y + h], [x + w - 4, y + h])}
          c="deep"
          o={0.2}
        />
        <Fill d={rr(c - 11, y + 4.5, 22, 9.5, 1)} c="sheet" />
        <Fill d={`M${c - 9} ${y + 18.5}Q${c} ${y + 27} ${c + 9} ${y + 18.5}Z`} c="deep" o={0.75} />
      </g>
      <g filter="url(#w-paint)">
        {/* the lacquered front: a lit upper band, a darker lower one */}
        <Brush d={`M${x + 3} ${y + 5}H${x + w - 4}`} w={4} c="gloss" o={0.3} taper={[0.06, 0.2]} />
        <Brush
          d={`M${x + 3} ${y + h - 6}H${x + w - 3}`}
          w={6}
          c="label"
          o={0.55}
          taper={[0.06, 0.1]}
        />
        <Brush
          d={`M${x + 6} ${y + h * 0.5}H${x + 18}`}
          w={5}
          c="blue-light"
          o={0.25}
          taper={[0.4, 0.4]}
        />
        <Brush
          d={`M${x + w - 16} ${y + h * 0.45}H${x + w - 5}`}
          w={5}
          c="deep"
          o={0.2}
          taper={[0.4, 0.4]}
        />
        <Stroke bold d={rr(x, y, w, h, 2)} w={1.2} />
        <Stroke d={rr(x + 3, y + 3, w - 6, h - 6, 1.5)} w={0.6} c="ink-soft" o={0.8} />
        <Stroke
          d={`M${x + 2} ${y + 1.5}H${x + w - 6}M${x + 1.5} ${y + 3}V${y + h - 4}`}
          w={0.9}
          c="gloss"
          o={0.7}
        />
        <Stroke d={`M${x + 4} ${y + h - 1.5}H${x + w - 3}`} w={1.4} c="blue-light" o={0.45} />
        {/* label holder and its card */}
        <Stroke d={rr(c - 11, y + 4.5, 22, 9.5, 1)} w={0.9} />
        <Stroke d={`M${c - 11} ${y + 14.2}H${c + 11}`} w={1.6} />
        <Stroke d={`M${c - 7} ${y + 9.5}H${c + 5}`} w={0.6} c="ink-soft" />
        <Rivet x={c - 13.5} y={y + 9.3} />
        <Rivet x={c + 13.5} y={y + 9.3} />
        {/* cup pull */}
        <Stroke d={`M${c - 9} ${y + 18.5}Q${c} ${y + 27} ${c + 9} ${y + 18.5}Z`} w={1} />
        <Stroke d={`M${c - 8} ${y + 18.6}H${c + 6}`} w={0.8} c="gloss" o={0.85} />
        <Stroke
          d={`M${c + 2} ${y + 23.4}Q${c + 6} ${y + 22} ${c + 7.5} ${y + 20}`}
          w={0.8}
          c="blue-light"
          o={0.6}
        />
      </g>
    </>
  );
}

const cardTabs = [-34, 6, -14, 12, -28];

function Cabinet() {
  return (
    <>
      <g filter="url(#w-flat)">
        <Fill
          d={cast(poly([-40, 96], [40, 96], [53, 86], [53, 156], [40, 168], [-40, 168]), 14, 13)}
          c="shadow"
        />
      </g>

      {/* the cabinet: top, front and the shaded side */}
      <g filter="url(#w-wash)">
        <Fill d={poly([-42, 100], [38, 100], [51, 90], [-29, 90])} c="indigo-wash" o={0.38} />
        <Fill d={rr(-42, 100, 80, 70, 1.5)} c="indigo-wash" o={0.62} />
        <Fill d={poly([38, 100], [51, 90], [51, 160], [38, 170])} c="indigo-wash" o={0.62} />
        <Fill d={poly([38, 100], [51, 90], [51, 160], [38, 170])} c="deep" o={0.34} />
        <Fill d={poly([-42, 165], [38, 165], [38, 170], [-42, 170])} c="deep" o={0.25} />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(-38, 104, 72, 30, 1)} c="deep" />
        <Fill d={rr(-40, 169, 8, 5, 1)} c="deep" />
        <Fill d={rr(28, 169, 8, 5, 1)} c="deep" />
      </g>

      <g filter="url(#w-paint)">
        <Stroke
          bold
          d={poly(
            [-42, 100],
            [-29, 90],
            [51, 90],
            [51, 160],
            [38, 170],
            [-42, 170],
            [-42, 100],
            [38, 100],
            [51, 90],
          )}
          w={1.5}
        />
        {/* the shaded side and the lit top, in strokes */}
        <Brush d="M44.5 98V162" w={8} c="label" o={0.55} taper={[0.05, 0.05]} />
        <Brush d="M48 96V158" w={3} c="gloss" o={0.25} taper={[0.1, 0.1]} />
        <Brush d="M-34 96H40" w={4} c="gloss" o={0.35} taper={[0.1, 0.3]} />
        <Brush d="M-26 92.5H46" w={3} c="blue-light" o={0.4} taper={[0.2, 0.3]} />
        <Brush d="M-40 104V166" w={3} c="gloss" o={0.8} taper={[0.1, 0.55]} pressure={0.4} />
        <Stroke d="M38 100V170" w={1.1} />
        <Stroke d="M-40 99H-30" w={1} c="gloss" o={0.8} />
        <Stroke d="M-28 91.5L-40 99.2" w={0.9} c="gloss" o={0.7} />
        <Stroke d="M40 103V167" w={1.8} c="blue-light" o={0.5} />
        <Stroke d="M44.5 98V164M48 95.5V161.5" w={0.6} c="ink-soft" o={0.7} />
        <Stroke d="M-40.5 104V166" w={0.9} c="gloss" o={0.6} />
        <Stroke d={rr(-38, 104, 72, 30, 1)} w={0.8} c="ink-soft" />
        <Stroke d={rr(-38, 138, 72, 28, 1)} w={0.6} c="ink-soft" o={0.6} />
        <Stroke d={`${rr(-40, 169, 8, 5, 1)}${rr(28, 169, 8, 5, 1)}`} w={0.9} />
      </g>

      <DrawerFront x={-38} y={138} w={72} h={28} />

      {/* the pulled drawer: its side, the cards, its front */}
      <g filter="url(#w-wash)">
        <Fill d={poly([28, 109], [34, 104], [34, 134], [28, 139])} c="indigo-wash" o={0.55} />
        <Fill d={poly([28, 109], [34, 104], [34, 134], [28, 139])} c="deep" o={0.3} />
        <Fill
          d={poly([-36, 139.5], [28, 139.5], [34, 135], [34, 145], [-31, 145])}
          c="deep"
          o={0.28}
        />
      </g>
      {[4, 3, 2, 1, 0].map((k) => {
        const lifted = k === 2;
        const ox = k * 1.5;
        const t = lifted ? 64 : 88 - k * 1.3;
        const x0 = -40 + ox;
        const x1 = 22 + ox;
        const tab = (cardTabs[k] ?? 0) + ox;
        const d = `M${x0} 112V${t}H${tab}V${t - 6}H${tab + 13}V${t}H${x1}V112Z`;
        return (
          <g key={k}>
            <g filter="url(#w-wash)">
              <Fill d={d} c="sheet" />
              <Fill d={d} c="deep" o={0.04 + k * 0.035} />
              {lifted && <Fill d={rr(tab + 1, t - 5, 11, 5, 1)} c="green" o={0.85} />}
              {lifted && <Fill d={`M${x1 - 5} ${t}H${x1}V112H${x1 - 5}Z`} c="deep" o={0.08} />}
            </g>
            <g filter="url(#w-paint)">
              <Stroke
                d={d}
                w={k === 0 || lifted ? 1 : 0.7}
                c={k === 0 || lifted ? "ink" : "ink-soft"}
              />
              {(lifted || k === 0) && (
                <>
                  <Stroke d={`M${x0 + 3} ${t + 5}H${x1 - 4}`} w={0.8} c="ink-soft" />
                  {[11, 16.5, 22].map((dy) => (
                    <Stroke
                      key={dy}
                      d={`M${x0 + 3} ${t + dy}H${x1 - 3}`}
                      w={0.6}
                      c="blue-light"
                      o={0.9}
                    />
                  ))}
                  <Stroke d={`M${x0 + 18} ${t + 7}V${t + 24}`} w={0.6} c="ink-soft" o={0.7} />
                  <Stroke d={`M${x0 + 1.5} ${t + 1.5}H${x0 + 20}`} w={0.8} c="gloss" o={0.8} />
                </>
              )}
              {lifted && (
                <Stroke d={`M${x0 + 21} ${t + 13.5}H${x0 + 36}`} w={1.4} c="green-deep" o={0.8} />
              )}
            </g>
          </g>
        );
      })}
      <DrawerFront x={-44} y={109} w={72} h={30} />

      <Boot y0={168} />
    </>
  );
}

/* Obsidian: a strongbox with a dial lock */

function Vault() {
  const dx = -6;
  const dy = 136;
  return (
    <>
      <g filter="url(#w-flat)">
        <Fill
          d={cast(poly([-40, 94], [40, 94], [53, 84], [53, 156], [40, 168], [-40, 168]), 14, 13)}
          c="shadow"
        />
      </g>

      <g filter="url(#w-wash)">
        <Fill d={poly([-42, 98], [38, 98], [51, 88], [-29, 88])} c="indigo-wash" o={0.42} />
        <Fill d={rr(-42, 98, 80, 72, 2)} c="indigo-wash" o={0.72} />
        <Fill d={poly([38, 98], [51, 88], [51, 160], [38, 170])} c="indigo-wash" o={0.72} />
        <Fill d={poly([38, 98], [51, 88], [51, 160], [38, 170])} c="deep" o={0.38} />
        <Fill d={poly([-42, 164], [38, 164], [38, 170], [-42, 170])} c="deep" o={0.22} />
        <Fill d={rr(-38, 102, 72, 64, 5)} c="deep" o={0.3} />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(-35, 105, 66, 58, 4)} c="deep" />
      </g>
      <g filter="url(#w-wash)">
        <Fill d="M-33 107H6C-8 122 -20 140 -33 160Z" c="indigo-wash" o={0.3} />
        <Fill d={rr(-41, 110, 7, 14, 3)} c="ink-soft" o={0.9} />
        <Fill d={rr(-41, 145, 7, 14, 3)} c="ink-soft" o={0.9} />
        <Fill d={rr(-15, 108, 30, 7.5, 1)} c="sheet" o={0.9} />
        <Fill d={ring(dx, dy, 17)} c="ink-soft" o={0.85} />
        <Fill d={ring(dx, dy, 13.5)} c="sheet" />
        <Fill
          d={`M${dx + 12} ${dy - 6}A13.5 13.5 0 0 1 ${dx - 6} ${dy + 12}A16 16 0 0 0 ${dx + 12} ${dy - 6}Z`}
          c="deep"
          o={0.22}
        />
        <Fill d={ring(20, dy, 4)} c="ink-soft" o={0.9} />
      </g>
      <g filter="url(#w-wash-dense)">
        <g className="w-turn-slow">
          <Fill d={gear(dx, dy, 5.5, 14, 1.6)} c="deep" />
        </g>
      </g>

      <g filter="url(#w-paint)">
        {/* box */}
        <Stroke
          bold
          d={poly(
            [-42, 98],
            [-29, 88],
            [51, 88],
            [51, 160],
            [38, 170],
            [-42, 170],
            [-42, 98],
            [38, 98],
            [51, 88],
          )}
          w={1.5}
        />
        {/* the shaded side, the lit top, and glazes on the door */}
        <Brush d="M44.5 96V162" w={8} c="label" o={0.6} taper={[0.05, 0.05]} />
        <Brush d="M48.5 94V158" w={2.6} c="gloss" o={0.25} taper={[0.1, 0.1]} />
        <Brush d="M-34 94H40" w={4} c="gloss" o={0.35} taper={[0.1, 0.3]} />
        <Brush d="M-26 90.5H46" w={3} c="blue-light" o={0.45} taper={[0.2, 0.3]} />
        <Brush d="M-39 100V168" w={3} c="gloss" o={0.85} taper={[0.1, 0.55]} pressure={0.4} />
        <Brush d="M-29 112V158" w={6} c="label" o={0.5} taper={[0.1, 0.1]} />
        <Brush d="M27 112V158" w={4} c="green-deep" o={0.22} taper={[0.1, 0.1]} />
        <Brush d="M-30 160H28" w={3} c="blue-light" o={0.35} taper={[0.2, 0.2]} />
        <Stroke d="M38 98V170" w={1.1} />
        <Stroke d="M-40 97H-28M-28 89.5L-40 97" w={0.9} c="gloss" o={0.75} />
        <Stroke d="M40 101V167" w={1.8} c="blue-light" o={0.5} />
        <Stroke d="M-40.5 102V166" w={0.9} c="gloss" o={0.6} />
        <Stroke d="M44 99L48 96M44 157L48 154" w={0.8} c="ink-soft" />
        {[-36, -26, -16, -6, 4, 14].map((x) => (
          <Rivet key={x} x={x} y={101.5} />
        ))}
        {[-36, -26, -16, -6, 4, 14, 24, 34].map((x) => (
          <Rivet key={x} x={x} y={167} />
        ))}
        {[102, 112, 122, 132, 142, 152].map((y, k) => (
          <Rivet key={y} x={44.5} y={y - k * 0.6} />
        ))}

        {/* door, its bevel and glints */}
        <Stroke d={rr(-35, 105, 66, 58, 4)} w={1.2} />
        <Stroke d={rr(-32, 108, 60, 52, 3)} w={0.6} c="blue-light" o={0.5} />
        <Stroke d="M-33 160V109Q-33 107 -31 107H20" w={0.9} c="gloss" o={0.55} />
        <Stroke d="M-30 163.5H30.5V108" w={1.6} c="blue-light" o={0.45} />
        <Stroke d="M-26 158L-2 108" w={0.7} c="gloss" o={0.4} />
        <Stroke d="M-18 160L-6 134" w={1.1} c="gloss" o={0.55} />
        <Stroke d="M14 158L24 146" w={0.6} c="gloss" o={0.45} />

        {/* hinges */}
        {[110, 145].map((y) => (
          <g key={y}>
            <Stroke d={rr(-41, y, 7, 14, 3)} w={1} />
            <Stroke d={`M-41 ${y + 4.5}H-34M-41 ${y + 9.5}H-34`} w={0.6} />
            <Stroke d={`M-39.5 ${y + 2}V${y + 12}`} w={0.8} c="gloss" o={0.8} />
          </g>
        ))}

        {/* nameplate */}
        <Stroke d={rr(-15, 108, 30, 7.5, 1)} w={0.9} />
        <Stroke d="M-9 111.8H9" w={0.6} c="ink-soft" />
        <Stroke d={`${ring(-12.5, 111.8, 1)}${ring(12.5, 111.8, 1)}`} w={0.6} />

        {/* dial */}
        <Stroke d={ring(dx, dy, 17)} w={1.2} />
        <Stroke d={ring(dx, dy, 13.5)} w={0.9} />
        <g className="w-turn-slow">
          <Stroke d={ring(dx, dy, 13.2)} w={0.1} o={0} />
          {Array.from({ length: 40 }, (_, k) => {
            const a = (k / 40) * Math.PI * 2;
            const r0 = k % 5 === 0 ? 9.2 : 11;
            return (
              <Stroke
                key={k}
                d={`M${(dx + Math.cos(a) * r0).toFixed(2)} ${(dy + Math.sin(a) * r0).toFixed(2)}L${(dx + Math.cos(a) * 12.8).toFixed(2)} ${(dy + Math.sin(a) * 12.8).toFixed(2)}`}
                w={k % 5 === 0 ? 0.75 : 0.45}
              />
            );
          })}
          <Stroke d={gear(dx, dy, 5.5, 14, 1.6)} w={0.8} />
        </g>
        <Stroke d={ring(dx, dy, 2)} w={0.7} c="gloss" o={0.9} />
        <Brush
          pts={ptsOfCircle(dx, dy, 15, Math.PI * 1.15, Math.PI * 1.6)}
          w={1.8}
          c="gloss"
          o={0.9}
          taper={[0.15, 0.55]}
        />
        <Brush
          pts={ptsOfCircle(dx, dy, 16, 0.35, 1.1)}
          w={2.4}
          c="blue-light"
          o={0.6}
          taper={[0.3, 0.3]}
        />

        {/* wheel handle */}
        {[0, 1, 2].map((k) => {
          const a = -Math.PI / 2 + (k * Math.PI * 2) / 3 + 0.35;
          const ex = 20 + Math.cos(a) * 11;
          const ey = dy + Math.sin(a) * 11;
          return (
            <g key={k}>
              <Stroke d={`M20 ${dy}L${ex.toFixed(1)} ${ey.toFixed(1)}`} w={2.2} />
              <Stroke d={ring(+ex.toFixed(1), +ey.toFixed(1), 2.4)} w={1} />
              <Dot x={ex - 0.6} y={ey - 0.8} r={0.8} o={0.9} />
            </g>
          );
        })}
        <Stroke d={ring(20, dy, 4)} w={1} />
        <Dot x={18.7} y={dy - 2} r={1} o={0.9} />

        {/* keyhole and lamp */}
        <Stroke d={`${ring(20, 154, 1.8)}M20 155.8V158.6`} w={0.9} c="gloss" o={0.75} />
        <Fill d={ring(24, 113, 2.8)} c="green" />
        <Stroke d={ring(24, 113, 2.8)} w={0.9} />
        <Dot x={23.3} y={112} r={0.9} o={0.9} />
        <Stroke d={`M${dx - 2} 116.8L${dx} 119.6L${dx + 2} 116.8`} w={1.2} c="green-deep" />
      </g>

      <Boot y0={170} />
    </>
  );
}

/* Sanity: a studio monitor with an editing panel on its screen */

function Monitor() {
  return (
    <>
      <g filter="url(#w-flat)">
        <Fill
          d={cast(poly([-40, 90], [40, 88], [50, 78], [50, 144], [34, 166], [-30, 168]), 14, 13)}
          c="shadow"
        />
      </g>

      <g filter="url(#w-wash)">
        <Fill d={poly([-36, 93], [34, 93], [46, 80], [-20, 80])} c="indigo-wash" o={0.32} />
        <Fill d={poly([36, 96], [48, 84], [48, 146], [36, 158])} c="indigo-wash" o={0.5} />
        <Fill d={poly([36, 96], [48, 84], [48, 146], [36, 158])} c="deep" o={0.28} />
        <Fill d={poly([-24, 172], [26, 172], [22, 165], [-20, 165])} c="indigo-wash" o={0.55} />
        <Fill d={rr(-9, 160, 18, 6, 1)} c="indigo-wash" o={0.7} />
        <Fill d={rr(-42, 92, 80, 70, 7)} c="sheet" />
        <Fill
          d={poly([33, 96], [38, 99], [38, 156], [32, 162], [-38, 162], [-40, 157], [30, 156])}
          c="deep"
          o={0.12}
        />
        <Fill d={rr(-38, 97, 61, 51, 7)} c="deep" o={0.28} />
        <Fill d={rr(-22, 150, 32, 7, 1)} c="indigo-wash" o={0.25} />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(-36, 99, 57, 47, 6)} c="deep" />
      </g>
      <g filter="url(#w-wash)">
        <Fill d="M-34 101H8L-34 136Z" c="indigo-wash" o={0.3} />
        <Fill d={rr(-19, 119, 14, 6, 1)} c="indigo-wash" o={0.85} />
        <Fill d={ring(29, 108, 4)} c="ink-soft" o={0.85} />
        <Fill d={ring(29, 121, 4)} c="ink-soft" o={0.85} />
      </g>

      <g filter="url(#w-paint)">
        {/* masses: the shaded side of the housing, cool shade on the bezel, glazes on the screen */}
        <Brush d="M42 92V150" w={8} c="label" o={0.4} taper={[0.05, 0.05]} />
        <Brush d="M-30 86H40" w={5} c="gloss" o={0.3} taper={[0.1, 0.3]} />
        <Brush d="M33 100V156" w={4.5} c="blue-light" o={0.35} taper={[0.15, 0.2]} pressure={0.3} />
        <Brush d="M-36 158.5H30" w={4} c="blue-light" o={0.32} taper={[0.15, 0.2]} />
        <Brush d="M-39 102Q-40 125 -39 150" w={3.4} c="gloss" o={0.75} taper={[0.15, 0.5]} />
        <Brush d="M-28 103V142" w={9} c="label" o={0.5} taper={[0.05, 0.05]} />
        <Brush d="M8 103V142" w={22} c="label" o={0.35} taper={[0.05, 0.05]} />
        <Brush d="M-12 103V142" w={12} c="green-deep" o={0.16} taper={[0.05, 0.05]} />
        {/* housing */}
        <Stroke bold d={path([-36, 93], [-20, 80], [46, 80], [34, 93])} w={1.2} />
        <Stroke bold d={path([46, 80], [48, 84], [48, 146], [36, 158])} w={1.2} />
        {[-10, 2, 14, 26].map((x) => (
          <Stroke key={x} d={`M${x} 90.5L${x + 8} 83`} w={0.8} c="ink-soft" />
        ))}
        <Stroke d="M-18 82.2H40" w={0.9} c="gloss" o={0.7} />
        <Stroke d="M41 96V152" w={0.6} c="ink-soft" o={0.7} />
        <Stroke d="M44.5 95V149" w={1.4} c="blue-light" o={0.45} />

        {/* stand */}
        <Stroke d={rr(-9, 160, 18, 6, 1)} w={1} />
        <Stroke bold d={poly([-24, 172], [26, 172], [22, 165], [-20, 165])} w={1.2} />
        <Stroke d="M-18 166.5H18" w={0.8} c="gloss" o={0.7} />

        {/* bezel */}
        <Stroke bold d={rr(-42, 92, 80, 70, 7)} w={1.5} />
        <Stroke d="M-39 150V100Q-39 95 -34 95H20" w={1} c="gloss" o={0.8} />
        <Stroke d="M-36 160H30Q35.5 160 35.5 154V102" w={1.8} c="blue-light" o={0.5} />
        <Stroke d={rr(-38, 97, 61, 51, 7)} w={0.7} c="ink-soft" />

        {/* screen: a sidebar, a list and the open document */}
        <Stroke d={rr(-36, 99, 57, 47, 6)} w={1.1} />
        <Stroke d="M-31 106H17" w={0.5} c="blue-light" o={0.6} />
        <Stroke d={`${ring(-30, 103, 0.8)}${ring(-27, 103, 0.8)}`} w={0.7} c="gloss" o={0.7} />
        <Stroke d="M-32 112H-25M-32 118H-26M-32 124H-24M-32 130H-26" w={1} c="gloss" o={0.65} />
        <Stroke d="M-32 112H-25" w={1} c="green-deep" taper={[0.05, 0.2]} pressure={0.1} />
        <Stroke d="M-21.5 109V142M-2.5 109V142" w={0.5} c="blue-light" o={0.55} />
        {[111, 119, 127, 135].map((y) => (
          <Stroke key={y} d={rr(-19, y, 14, 6, 1)} w={0.55} c="blue-light" o={0.85} />
        ))}
        <Stroke d="M-17 122H-9" w={0.8} c="gloss" o={0.9} />
        <Stroke d="M0 113H13" w={1.2} c="gloss" o={0.9} taper={[0.05, 0.3]} pressure={0.1} />
        <Stroke d="M0 119H17M0 123.5H15M0 128H17" w={0.7} c="blue-light" o={0.85} />
        <Stroke d={rr(0, 132.5, 17, 7, 1)} w={0.8} c="green-deep" />
        <g className="w-blink">
          <Stroke d="M3.5 134.5V137.5" w={0.9} c="green-deep" />
        </g>
        {/* glass */}
        <Stroke d="M-32.5 104Q-34 122 -31.5 141" w={0.9} c="gloss" o={0.6} />
        <Stroke d="M-8 101L-24 144" w={0.6} c="gloss" o={0.3} />
        <Stroke d="M-4 102L-14 128" w={1.2} c="gloss" o={0.45} />
        <Stroke d="M-31 101.5Q-28 100.4 -24 100.6" w={1.4} c="gloss" o={0.85} />

        {/* controls */}
        {[108, 121].map((y) => (
          <g key={y}>
            <Stroke d={ring(29, y, 4)} w={1} />
            <Stroke d={`M29 ${y}L${31.5} ${y - 2.6}`} w={0.9} />
            <Stroke
              d={`M26.5 ${y - 1.6}Q27.5 ${y - 3.4} 29.5 ${y - 3.6}`}
              w={0.7}
              c="gloss"
              o={0.85}
            />
          </g>
        ))}
        <Stroke d="M25 132H33M25 135.5H33M25 139H33M25 142.5H33M25 146H33" w={0.8} c="ink-soft" />
        <Fill d={ring(29, 155, 2.4)} c="green" />
        <Stroke d={ring(29, 155, 2.4)} w={0.8} />
        <Stroke d={rr(-22, 150, 32, 7, 1)} w={0.7} c="ink-soft" />
        <Stroke d="M-18 153.5H2" w={0.9} c="cream" o={0.9} />
        <Screw x={-35} y={155} r={2.6} />
      </g>

      <Boot y0={172} />
    </>
  );
}

const sourceArt = [Manuscript, Cabinet, Vault, Monitor];

/* the site: a small cousin of the press */

function Site() {
  const lampY = 422;
  return (
    <>
      <g filter="url(#w-flat)">
        <Fill d={cast(rr(108, 312, 304, 120, 20), 24, 17)} c="shadow" />
        {/* each jack, sleeve, body and collar, moved as its cord's shadow is, so the two run into each other */}
        {cords.map(({ jx }) => (
          <g key={jx} transform="translate(10 6)">
            <Fill
              d={`${poly([jx - 2.6, cordEnd - 1], [jx + 2.6, cordEnd - 1], [jx + 4.6, 289], [jx - 4.6, 289])}${rr(jx - 6.5, 288, 13, 19, 2.5)}${poly([jx - 9, 306], [jx + 9, 306], [jx + 10.5, 311], [jx + 9, 316], [jx - 9, 316], [jx - 10.5, 311])}`}
              c="shadow"
            />
          </g>
        ))}
      </g>

      {/* underpainting, then the masses of the case in strokes of several blues */}
      <g filter="url(#w-wash)">
        <Fill d={rr(108, 312, 304, 120, 20)} c="indigo-wash" o={0.8} />
        <Fill d={rr(92, 348, 20, 54, 7)} c="indigo-wash" o={0.45} />
        <Fill
          d="M404 330Q412 380 400 426Q300 432 124 428Q300 422 392 416Q402 380 396 332Z"
          c="deep"
          o={0.22}
        />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(128, 350, 202, 62, 8)} c="deep" />
        <Fill d={rr(340, 350, 52, 62, 5)} c="label" />
      </g>
      <g filter="url(#w-paint)">
        {/* crank */}
        <Brush d="M97 352V398" w={6} c="gloss" o={0.42} taper={[0.05, 0.1]} pressure={0.2} />
        <Brush d="M105 350V400" w={7} c="indigo-wash" o={0.95} taper={[0.05, 0.1]} />
        <Brush d="M109 354V396" w={3} c="label" o={0.6} taper={[0.1, 0.1]} />
        {/* left band, turned to the light */}
        <Brush
          d="M117 328Q114 372 117 416"
          w={10}
          c="indigo-wash"
          taper={[0.05, 0.05]}
          pressure={0.15}
        />
        <Brush d="M123 334Q121 372 123 410" w={7} c="gloss" o={0.42} taper={[0.08, 0.08]} />
        <Brush d="M122 350Q120 372 123 398" w={5} c="blue-light" o={0.3} taper={[0.2, 0.2]} />
        {/* top and lower bands */}
        <Brush
          d="M128 318Q260 315 392 318"
          w={9}
          c="indigo-wash"
          taper={[0.05, 0.05]}
          pressure={0.15}
        />
        <Brush d="M132 345H396" w={5} c="gloss" o={0.3} taper={[0.06, 0.1]} pressure={0.2} />
        <Brush d="M134 417H394" w={6} c="gloss" o={0.26} taper={[0.06, 0.1]} pressure={0.2} />
        <Brush d="M124 426Q260 429 396 425" w={9} c="indigo-wash" taper={[0.05, 0.05]} />
        <Brush d="M128 431Q260 434 392 430" w={5} c="label" o={0.7} taper={[0.1, 0.1]} />
        {/* right band, turned away */}
        <Brush d="M403 330Q406 372 403 414" w={9} c="label" o={0.85} taper={[0.05, 0.05]} />
        <Brush d="M397 352V410" w={5} c="gloss" o={0.24} taper={[0.06, 0.06]} />
        {/* broken patches of lighter and darker blue */}
        <Brush d="M116 340Q115 360 117 380" w={6} c="blue-light" o={0.28} taper={[0.4, 0.4]} />
        <Brush d="M160 425Q210 426 260 424" w={6} c="blue-light" o={0.22} taper={[0.4, 0.4]} />
        <Brush d="M290 426Q330 427 370 425" w={6} c="deep" o={0.25} taper={[0.4, 0.4]} />
        <Brush d="M404 360Q405 380 403 400" w={5} c="blue-light" o={0.2} taper={[0.4, 0.4]} />
        {/* glazes over the dark window and the label strip */}
        <Brush d="M134 381H324" w={48} c="label" o={0.4} taper={[0.04, 0.04]} pressure={0.15} />
        <Brush d="M300 354V408" w={34} c="green-deep" o={0.2} taper={[0.05, 0.05]} pressure={0.1} />
        <Brush d="M150 404Q146 380 160 356" w={12} c="indigo-wash" o={0.22} taper={[0.3, 0.3]} />
        <Brush d="M366 353V409" w={40} c="green-deep" o={0.2} taper={[0.05, 0.05]} pressure={0.1} />
        <Brush d="M132 353H326" w={4} c="gloss" o={0.45} taper={[0.012, 0.02]} pressure={0.2} />
        <Brush d="M131.5 355V407" w={4} c="gloss" o={0.5} taper={[0.02, 0.03]} />
        <Brush d="M132 409H326" w={3} c="gloss" o={0.32} taper={[0.02, 0.03]} />
        <Brush d="M344 354V408" w={2.6} c="gloss" o={0.3} taper={[0.02, 0.03]} />
      </g>
      <g filter="url(#w-wash)">
        <Fill d="M132 354H232C204 372 170 392 146 408H132Z" c="indigo-wash" o={0.28} />
        <Fill d={ring(194, 381, 21)} c="ink-soft" o={0.75} />
        <Fill d={ring(266, 381, 21)} c="ink-soft" o={0.7} />
        <Fill d={ring(194, 381, 8)} c="green" o={0.8} />
        <Fill d={ring(266, 381, 8)} c="green" o={0.7} />
      </g>

      <g filter="url(#w-paint)">
        {/* rim of the case and the crank, in two passes */}
        <Brush d={rr(108, 312, 304, 120, 20)} w={4} c="label" loop={3} seed={3} pressure={0.35} />
        <Brush d={rr(109, 313, 302, 118, 19)} w={1.8} c="ink" o={0.9} loop={3} seed={11} />
        <Brush d={rr(92, 348, 20, 54, 7)} w={2.6} c="label" loop={2} seed={5} />
        <Brush d={rr(92, 348, 20, 54, 7)} w={1.3} c="ink" o={0.85} loop={2} seed={8} />
        <Brush d="M95 354Q93 375 96 396" w={2.4} c="gloss" o={0.9} taper={[0.2, 0.4]} />
        <Brush d="M100 362V388" w={1.2} c="blue-light" o={0.8} taper={[0.3, 0.3]} />
        {/* highlights, bold to thin, on the lit edges */}
        <Brush
          d="M112 334Q109 372 113 412"
          w={3.6}
          c="blue-light"
          o={0.9}
          taper={[0.3, 0.4]}
          pressure={0.4}
        />
        <Brush
          d="M119 330Q116 370 120 410"
          w={5}
          c="gloss"
          o={0.88}
          taper={[0.12, 0.55]}
          pressure={0.45}
        />
        <Brush d="M126 338V408" w={2.4} c="gloss" o={0.85} taper={[0.1, 0.4]} pressure={0.35} />
        <Brush d="M121 346Q127 372 121 400" w={1.2} c="cream" o={0.9} taper={[0.3, 0.3]} />
        <Brush d="M113 330Q114 315 132 314" w={3.4} c="gloss" o={0.92} taper={[0.2, 0.5]} />
        <Brush d="M140 315Q240 313 340 315" w={2.2} c="gloss" o={0.7} taper={[0.2, 0.5]} />
        <Brush d="M132 321H392" w={1.2} c="blue-light" o={0.75} taper={[0.3, 0.3]} />
        <Brush d="M114 412Q116 428 132 430" w={3} c="blue-light" o={0.9} taper={[0.3, 0.3]} />
        <Brush d="M134 428Q260 431 390 427" w={2} c="gloss" o={0.6} taper={[0.3, 0.4]} />
        <Brush d="M150 421H330" w={1.1} c="cream" o={0.7} taper={[0.3, 0.3]} />
        <Brush d="M407 336Q410 372 406 412" w={2.4} c="blue-light" o={0.55} taper={[0.3, 0.3]} />
        <Brush d="M392 316Q406 320 408 336" w={2.4} c="gloss" o={0.8} taper={[0.2, 0.5]} />

        {/* window and frame */}
        <Brush d={rr(128, 350, 202, 62, 8)} w={2.2} c="ink" o={0.9} loop={3} seed={13} />
        <Stroke d={rr(133, 355, 192, 52, 6)} w={0.7} c="ink-soft" o={0.8} />
        {Array.from({ length: 19 }, (_, k) => (
          <Stroke
            key={k}
            d={`M${142 + k * 10} 356V${k % 4 === 0 ? 362 : 359}`}
            w={0.8}
            c="gloss"
            o={0.5}
          />
        ))}
        {/* inside the window, the pages of every desk, collated into one stack, with the tab of each source */}
        {Array.from({ length: 8 }, (_, k) => {
          const y = 398 - k * 4.6;
          const x = 176 + ((k * 7) % 5) - 2;
          const tab = ["fill-w-green", "fill-w-cream", "fill-w-blue-light", "fill-w-gloss"][k % 4]!;
          return (
            <g key={k}>
              <path d={`M${x} ${y}h106v3.6h-106z`} className="fill-w-sheet" />
              <path
                d={`M${x} ${y}h106`}
                className="stroke-w-ink"
                strokeWidth={0.6}
                opacity={0.55}
              />
              <path d={`M${x + 106} ${y + 0.4}h5v2.8h-5z`} className={tab} opacity={0.9} />
            </g>
          );
        })}
        <path d="M172 402.5H290" className="stroke-w-ink" strokeWidth={1.1} opacity={0.7} />
        <Stroke d="M182 366H276" w={0.7} c="gloss" o={0.5} />
        <Stroke d="M138 405H184V396" w={2.2} c="green-deep" o={0.8} />
        <Stroke d="M214 356Q250 382 236 408" w={0.9} c="gloss" o={0.65} />
        <Stroke d="M224 358Q256 382 248 407" w={0.6} c="gloss" o={0.5} />
        <Stroke d="M170 408L222 352" w={0.6} c="gloss" o={0.4} />
        {/* glass: long scratches of white, blue and cream */}
        <Brush
          d="M176 408Q200 376 244 354"
          w={2.8}
          c="gloss"
          o={0.72}
          taper={[0.4, 0.35]}
          pressure={0.35}
        />
        <Brush d="M186 408Q210 378 252 356" w={2} c="blue-light" o={0.8} taper={[0.3, 0.4]} />
        <Brush d="M168 400Q190 374 226 356" w={1.1} c="cream" o={0.85} taper={[0.3, 0.3]} />
        <Brush d="M140 404Q138 380 150 358" w={1.4} c="gloss" o={0.55} taper={[0.4, 0.4]} />

        {/* label strip */}
        <Brush d={rr(340, 350, 52, 62, 5)} w={2} c="ink" o={0.85} loop={2} seed={17} />
        <Stroke d="M346 362V355H353" w={1.2} c="gloss" o={0.9} />
        <Stroke d="M386 400V407H379" w={1.2} c="gloss" o={0.9} />

        {/* screws, vents, gear, lamps */}
        <Screw x={122} y={326} />
        <Screw x={398} y={326} a={0.4} />
        <Screw x={122} y={418} a={0.2} />
        <Screw x={398} y={418} a={-0.9} />
        {[0, 1, 2].map((g) =>
          Array.from({ length: 5 }, (_, k) => {
            const x = 176 + g * 64 + k * 6;
            return <Stroke key={`${g}-${k}`} d={`M${x} 417.5V426`} w={1.6} />;
          }),
        )}
        <g className="w-turn">
          <Stroke d={gear(142, 421, 5, 9, 2.2)} w={0.9} />
          <Stroke d={`${ring(142, 421, 1.8)}M142 419.2V416.6`} w={0.7} />
        </g>
      </g>

      <VerticalText
        x={366}
        y={360}
        glyphs={["S", "I", "T", "E"]}
        size={12.5}
        gap={2.6}
        className="fill-w-gloss"
        style={{ fontFamily: "var(--default-font-family)", letterSpacing: 0 }}
      />

      {/* a socket per source: its path plate and lamp, which light as the slip arrives, and its jack */}
      {cords.map(({ jx, key }, i) => {
        const sleeve = poly(
          [jx - 2.6, cordEnd - 1],
          [jx + 2.6, cordEnd - 1],
          [jx + 4.6, 289],
          [jx - 4.6, 289],
        );
        const collar = poly(
          [jx - 9, 306],
          [jx + 9, 306],
          [jx + 10.5, 311],
          [jx + 9, 316],
          [jx - 9, 316],
          [jx - 10.5, 311],
        );
        const lit = { "--i": i } as CSSProperties;
        return (
          <g key={jx} data-key={key}>
            <g filter="url(#w-wash)">
              <Fill d={rr(jx - 30, 321, 60, 20, 3)} c="sheet" o={0.95} />
              <Fill
                d={`M${jx - 30} 337H${jx + 30}V338Q${jx + 30} 341 ${jx + 27} 341H${jx - 27}Q${jx - 30} 341 ${jx - 30} 338Z`}
                c="deep"
                o={0.12}
              />
            </g>
            <g filter="url(#w-paint)">
              <Stroke d={rr(jx - 30, 321, 60, 20, 3)} w={1} />
              <Stroke d={`M${jx - 27} 323.2H${jx + 12}`} w={0.7} c="gloss" o={0.8} />
              <Stroke d={ring(jx, lampY, 3.2)} w={0.9} />
            </g>
            <g className="w-light" style={lit}>
              <text
                x={jx}
                y={335.5}
                fontSize={11}
                textAnchor="middle"
                className="w-caption fill-w-text font-mono"
              >
                {sources[i]!.path}
              </text>
              <g filter="url(#w-paint)" className="w-breathe" style={lit}>
                <Fill d={ring(jx, lampY, 3.2)} c="green" />
                <Stroke d={ring(jx, lampY, 5.6)} w={0.8} c="green-deep" o={0.6} />
                <Dot x={jx - 1} y={lampY - 1.2} r={1} o={0.9} />
              </g>
            </g>
            <g filter="url(#w-wash-dense)">
              <Fill d={collar} c="deep" />
            </g>
            <g filter="url(#w-wash)">
              <Fill d={rr(jx - 6.5, 288, 13, 19, 2.5)} c="sheet" />
              <Fill d={rr(jx + 2, 289, 4.5, 17, 2)} c="deep" o={0.16} />
              <Fill d={sleeve} c="sheet" />
              <Fill
                d={poly([jx + 0.8, cordEnd], [jx + 2.6, cordEnd], [jx + 4.6, 289], [jx + 1.6, 289])}
                c="deep"
                o={0.16}
              />
              <Fill
                d={poly(
                  [jx - 9, 306],
                  [jx - 1, 306],
                  [jx - 3, 316],
                  [jx - 9, 316],
                  [jx - 10.5, 311],
                )}
                c="indigo-wash"
                o={0.35}
              />
            </g>
            <g filter="url(#w-paint)">
              <Stroke d={collar} w={1.1} />
              <Stroke d={`M${jx - 8} 307.4H${jx + 3}`} w={0.8} c="gloss" o={0.8} />
              <Stroke d={`M${jx - 7} 314.6H${jx + 8}`} w={1.2} c="blue-light" o={0.55} />
              <Stroke d={`M${jx - 3} 306V316M${jx + 3} 306V316`} w={0.5} c="ink-soft" o={0.8} />
              <Stroke bold d={rr(jx - 6.5, 288, 13, 19, 2.5)} w={1.1} />
              {[292, 295, 298, 301].map((y) => (
                <Stroke key={y} d={`M${jx - 4.5} ${y}H${jx + 4.5}`} w={0.6} c="ink-soft" />
              ))}
              <Stroke d={`M${jx - 4.8} 290V305`} w={0.8} c="gloss" o={0.8} />
              <Stroke d={sleeve} w={1} />
              {[279.5, 282.5, 285.5].map((y) => {
                const hw = 2.6 + ((y - cordEnd + 1) / (289 - cordEnd + 1)) * 2;
                return (
                  <Stroke
                    key={y}
                    d={`M${(jx - hw).toFixed(1)} ${y}H${(jx + hw).toFixed(1)}`}
                    w={0.6}
                    c="ink-soft"
                  />
                );
              })}
            </g>
          </g>
        );
      })}
    </>
  );
}

export function SourcesFigure() {
  return (
    <svg
      viewBox="0 0 520 452"
      className="block w-full overflow-visible"
      role="img"
      aria-label="MDX files, Notion, Obsidian and Sanity, each plugged by a cord into one site, where their pages live under /docs, /guides, /notes and /blog"
    >
      {sources.map((s, i) => {
        const Art = sourceArt[i]!;
        return (
          <g key={s.name} data-key={s.key}>
            <g style={{ "--i": i } as CSSProperties}>
              <text
                x={s.label}
                y={22}
                fontSize={14}
                textAnchor="middle"
                className="w-caption fill-w-text font-serif"
              >
                {s.name}
              </text>
              <text
                x={s.label}
                y={41}
                fontSize={11.5}
                textAnchor="middle"
                className="w-caption fill-w-muted font-mono"
              >
                {s.path}
              </text>
              <g transform={`translate(${s.x} 0)`}>
                <Art />
              </g>
            </g>
          </g>
        );
      })}

      {/* cords: flat shadow, inked edge, pale core */}
      <g filter="url(#w-flat)">
        <g transform="translate(10 6)">
          {cords.map(({ d, pts, key }, i) => (
            <g key={d} data-key={key} style={{ "--i": i } as CSSProperties}>
              <Fill d={ribbon(pts, 3.6)} c="shadow" />
            </g>
          ))}
        </g>
      </g>
      <g filter="url(#w-paint)">
        {/* each cord fades in with its source, so it never hangs from nothing */}
        {cords.map(({ d, pts, key }, i) => (
          <g key={d} data-key={key} style={{ "--i": i } as CSSProperties}>
            <Brush d={d} w={4.6} taper={[0.02, 0.02]} pressure={0.12} />
            <Fill d={ribbon(pts, 2.2)} c="sheet" />
            <g transform="translate(0.7 0)">
              <Brush d={d} w={1} c="blue-light" o={0.6} taper={[0.1, 0.1]} />
            </g>
            <g transform="translate(-0.6 0)">
              <Brush d={d} w={1.1} c="gloss" o={0.9} taper={[0.05, 0.4]} pressure={0.35} />
            </g>
          </g>
        ))}
      </g>
      {/* paper slips carried along each cord: once on view, then now and then (run by `Layered`, see data-travel) */}
      {cords.map(({ d, key }, i) => (
        <g
          key={d}
          data-key={key}
          data-travel={d}
          data-cycle={slipCycle}
          data-share={slipTravel}
          data-delay={slipDelay(i) + 0.3}
        >
          {/* the slip grows out of the source's boot and shrinks into the site's jack, it never comes from nowhere */}
          <path d="M-6 -8H6V8H-6Z" className="fill-w-sheet stroke-w-ink" strokeWidth={1} />
          <path d="M-3 -3H3M-3 1H2" className="stroke-w-ink-soft" strokeWidth={0.8} />
        </g>
      ))}

      <Site />
    </svg>
  );
}
