import { cn } from "../cn";
import { PlugSvg } from "./plugs";
import {
  Brush,
  Fill,
  Line,
  Sketch,
  VerticalText,
  circle,
  gear,
  ptsOfCircle,
  rr,
  type Pt,
  cast,
} from "./pen";

export { InkDefs } from "./pen";

/* the press of the hero, painted in strokes of gouache */

const pageColumns = [300, 284, 268, 252, 236, 220, 204, 188, 172];
const columnEnds = [-6, 30, 18, 34, 4, 26, 36, 12, 22];

/** where the cord leaves the press, in the viewBox of `HeroPress` */
export const pressJack = { x: 333, y: 456, width: 540, height: 640, top: -70 };

/** points of a tilted ellipse, from and to an angle */
function ellPts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  from = 0,
  to = Math.PI * 2,
): Pt[] {
  const n = Math.max(16, Math.ceil((Math.abs(to - from) * Math.max(rx, ry)) / 2));
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return Array.from({ length: n + 1 }, (_, k): Pt => {
    const a = from + ((to - from) * k) / n;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}

function polyD(pts: Pt[]) {
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

const reels = [150, 326];
const oval = { cx: 222, cy: 238, rx: 13, ry: 48, rot: 0.34 };
const screws: Pt[] = [
  [60, 80],
  [400, 80],
  [60, 390],
  [400, 390],
];
const sprockets: [number, number][] = [
  [130, 6.5],
  [172, 4.6],
  [214, 6],
  [256, 4.4],
  [298, 6.2],
  [340, 5],
];

export function HeroPress({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 ${pressJack.top} ${pressJack.width} ${pressJack.height}`}
      className={className}
      role="img"
      aria-label="A hand-painted press printing a page of vertical text"
    >
      {/* flat shadows on the paper */}
      <g filter="url(#w-flat)">
        {/* the case's own outline, its side button and its plug, cast down and right; one path, so where they
            overlap the shadow does not darken twice */}
        <Fill d={cast(rr(40, 60, 380, 350, 28), 60, 46)} c="shadow" />
        <Fill
          // with the neck the cord leaves from, down to it, so the cord's shadow starts where this one ends
          d={cast(
            "M318 412H348V430Q348 444 340 448H337L336 456H330L329 448H326Q318 444 318 430Z",
            14,
            8,
          )}
          c="shadow"
        />
        <Fill d={rr(110, 402, 320, 20, 10)} c="ink" o={0.06} />
        <Fill d={rr(410, 104, 22, 314, 11)} c="ink" o={0.05} />
      </g>

      {/* the printed page, coming out of the slot once; the case, drawn after it, hides the rest.
          No clip path: \`Layered\` renders this SVG twice, and a duplicated id resolves to the hidden copy */}
      <g>
        <g className="w-print">
          <g filter="url(#w-flat)">
            <Fill d={cast("M128 64L118 -46L326 -56L338 64Z", 40, 30)} c="shadow" />
          </g>
          <g filter="url(#w-wash)">
            <Fill d="M128 64L118 -46L326 -56L338 64Z" c="sheet" />
            <Fill d="M127 64L125 36Q232 30 335 34L338 64Z" c="ink" o={0.08} />
            <Fill d="M300 -54L326 -56L338 64L312 64Z" c="ink" o={0.05} />
          </g>
          <g filter="url(#w-paint)">
            <Brush d="M128 66L118 -46" w={1.8} c="ink-soft" taper={[0.1, 0.2]} />
            <Brush d="M116 -45L328 -57" w={1.6} c="ink-soft" taper={[0.1, 0.3]} />
            <Brush d="M326 -54L339 66" w={2.2} c="ink-soft" taper={[0.2, 0.1]} />
            {pageColumns.map((x, i) => (
              <Brush
                key={x}
                d={`M${x + 1 - i * 0.55} ${-40 + i * 0.3}L${x + 1.6 - i * 0.55} ${columnEnds[i]}`}
                w={i === 0 ? 3 : 1.6}
                c="ink-soft"
                o={i === 0 ? 0.9 : 0.75}
                taper={[0.08, 0.35]}
              />
            ))}
          </g>
          <g filter="url(#w-wash)">
            <Fill d="M227 -14L247 -15L248 2L228 3Z" c="green" o={0.55} />
            <Fill d={rr(140, 20, 17, 17, 2)} c="seal" o={0.85} />
          </g>
          <text
            x={148.5}
            y={29}
            fontSize={11}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-w-gloss font-serif"
          >
            文
          </text>
        </g>
      </g>

      {/* underpainting: a wash so the strokes above never leave a gap */}
      <g filter="url(#w-wash)">
        <Fill d={rr(40, 60, 380, 350, 28)} c="indigo-wash" o={0.85} />
        <Fill d={rr(20, 172, 26, 120, 8)} c="indigo-wash" o={0.5} />
        <Fill d="M318 412H348V430Q348 444 340 448H326Q318 444 318 430Z" c="sheet" o={0.95} />
      </g>

      {/* masses of the case, laid in broad strokes of several blues */}
      <g filter="url(#w-paint)">
        {/* side button */}
        <Brush d="M28 178V288" w={9} c="gloss" o={0.42} taper={[0.05, 0.1]} pressure={0.2} />
        <Brush d="M38 176V290" w={9} c="indigo-wash" o={0.95} taper={[0.05, 0.1]} />
        <Brush d="M42 180V286" w={4} c="label" o={0.6} taper={[0.1, 0.1]} />

        {/* left band: cobalt, then a translucent slate */}
        <Brush
          d="M52 84Q49 236 53 392"
          w={12}
          c="indigo-wash"
          taper={[0.05, 0.05]}
          pressure={0.15}
        />
        <Brush d="M64 92Q61 236 64 384" w={12} c="gloss" o={0.46} taper={[0.08, 0.08]} />
        <Brush d="M63 120Q60 236 64 350" w={8} c="blue-light" o={0.3} taper={[0.2, 0.2]} />
        <Brush d="M70 96V380" w={6} c="label" o={0.4} taper={[0.05, 0.05]} pressure={0.1} />

        {/* top band */}
        <Brush
          d="M62 68Q230 63 398 68"
          w={11}
          c="indigo-wash"
          taper={[0.05, 0.05]}
          pressure={0.15}
        />
        <Brush d="M70 80Q230 77 392 81" w={9} c="label" o={0.35} taper={[0.08, 0.08]} />
        <Brush d="M74 90H392" w={7} c="gloss" o={0.34} taper={[0.06, 0.1]} pressure={0.2} />

        {/* bottom band */}
        <Brush d="M72 386H398" w={7} c="gloss" o={0.3} taper={[0.06, 0.1]} pressure={0.2} />
        <Brush d="M60 396Q230 399 402 395" w={10} c="indigo-wash" taper={[0.05, 0.05]} />
        <Brush d="M62 404Q230 408 396 403" w={7} c="label" o={0.75} taper={[0.1, 0.1]} />

        {/* broken patches of lighter and darker blue over the masses */}
        <Brush d="M50 120Q48 170 51 220" w={8} c="blue-light" o={0.28} taper={[0.4, 0.4]} />
        <Brush d="M52 260Q50 300 53 350" w={9} c="label" o={0.3} taper={[0.4, 0.4]} />
        <Brush d="M120 66Q180 64 250 66" w={8} c="blue-light" o={0.25} taper={[0.4, 0.4]} />
        <Brush d="M270 70Q320 68 380 71" w={8} c="label" o={0.3} taper={[0.4, 0.4]} />
        <Brush d="M110 397Q170 398 230 396" w={8} c="blue-light" o={0.22} taper={[0.4, 0.4]} />
        <Brush d="M250 395Q300 397 360 394" w={7} c="deep" o={0.25} taper={[0.4, 0.4]} />
        <Brush d="M409 140Q411 200 409 260" w={7} c="blue-light" o={0.2} taper={[0.4, 0.4]} />
        <Brush d="M411 280Q413 330 410 372" w={7} c="deep" o={0.3} taper={[0.4, 0.4]} />
        {/* right band, turned away from the light */}
        <Brush d="M330 98V380" w={6} c="deep" o={0.55} taper={[0.05, 0.05]} pressure={0.15} />
        <Brush d="M338 96V382" w={7} c="gloss" o={0.3} taper={[0.06, 0.06]} />
        <Brush d="M402 94V384" w={8} c="gloss" o={0.28} taper={[0.06, 0.06]} />
        <Brush d="M410 90Q413 236 410 386" w={9} c="indigo-wash" taper={[0.05, 0.05]} />
        <Brush d="M416 100Q419 236 415 380" w={6} c="label" o={0.8} taper={[0.08, 0.1]} />
      </g>

      {/* the dark interior */}
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(74, 96, 252, 284, 6)} c="deep" />
        <Fill d={rr(344, 96, 52, 284, 5)} c="label" />
        <Fill d={rr(112, 52, 236, 16, 5)} c="deep" />
        {reels.map((cy) => (
          <Fill key={cy} d={circle(220, cy, 35)} c="deep" />
        ))}
        <Fill d={polyD(ellPts(oval.cx, oval.cy, oval.rx, oval.ry, oval.rot))} c="deep" />
      </g>

      {/* glazes over the dark: navy, cobalt and a green tint */}
      <g filter="url(#w-paint)">
        <Brush d="M140 104V372" w={26} c="label" o={0.6} taper={[0.05, 0.05]} pressure={0.2} />
        <Brush d="M100 104V372" w={18} c="label" o={0.45} taper={[0.05, 0.05]} />
        <Brush d="M292 104V372" w={34} c="label" o={0.5} taper={[0.05, 0.05]} pressure={0.2} />
        <Brush d="M220 112V364" w={70} c="label" o={0.35} taper={[0.04, 0.04]} pressure={0.15} />
        <Brush d="M150 360Q140 250 162 120" w={14} c="indigo-wash" o={0.22} taper={[0.3, 0.3]} />
        <Brush
          d="M370 100V376"
          w={44}
          c="green-deep"
          o={0.22}
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        {reels.map((cy) => (
          <Brush
            key={cy}
            pts={ptsOfCircle(220, cy, 18)}
            w={34}
            c="green-deep"
            o={0.17}
            pressure={0.2}
          />
        ))}
        <Brush
          pts={ellPts(oval.cx, oval.cy, oval.rx * 0.5, oval.ry * 0.82, oval.rot)}
          w={14}
          c="green-deep"
          o={0.2}
        />
        <Brush d="M80 102H322" w={7} c="gloss" o={0.52} taper={[0.012, 0.018]} pressure={0.2} />
        <Brush d="M80 374H322" w={7} c="gloss" o={0.46} taper={[0.012, 0.018]} pressure={0.2} />
        <Brush d="M83 104V372" w={6} c="gloss" o={0.52} taper={[0.012, 0.018]} />
        <Brush d="M117 108V368" w={5} c="gloss" o={0.46} taper={[0.012, 0.018]} />
        <Brush d="M125 112V364" w={3.4} c="indigo-wash" o={0.95} taper={[0.1, 0.2]} />
        <Brush d="M176 108V368" w={6} c="gloss" o={0.52} taper={[0.012, 0.018]} pressure={0.2} />
        <Brush d="M264 108V368" w={6} c="gloss" o={0.48} taper={[0.012, 0.018]} pressure={0.2} />
        <Brush d="M178 111H262" w={5} c="gloss" o={0.46} taper={[0.012, 0.018]} />
        <Brush d="M178 365H262" w={5} c="gloss" o={0.32} taper={[0.012, 0.018]} />
        <Brush d="M272 116V360" w={2.6} c="indigo-wash" o={0.9} taper={[0.2, 0.2]} />
        <Brush d="M318 106V370" w={5} c="gloss" o={0.34} taper={[0.012, 0.018]} />
        <Brush d="M350 104V372" w={3.4} c="gloss" o={0.28} taper={[0.012, 0.018]} />
        <Brush d="M389 112V364" w={2.8} c="indigo-wash" o={0.95} taper={[0.15, 0.15]} />
        {/* the gauge and the green rule */}
        <Brush d="M296 114V364" w={2.6} c="gloss" o={0.4} taper={[0.08, 0.08]} />
        {Array.from({ length: 22 }, (_, i) => (
          <Brush
            key={i}
            d={`M297 ${116 + i * 11.5}H${i % 4 === 0 ? 310 : 304}`}
            w={i % 4 === 0 ? 2 : 1.5}
            c="gloss"
            o={0.6}
            taper={[0, 0.7]}
            pressure={0.1}
          />
        ))}
        <Brush
          d="M150 360H262"
          w={5}
          c="green-deep"
          o={0.95}
          taper={[0.15, 0.02]}
          pressure={0.15}
        />
        <Brush
          d="M260 362V326"
          w={4.4}
          c="green-deep"
          o={0.95}
          taper={[0.02, 0.3]}
          pressure={0.15}
        />
        <Brush d="M156 358H258" w={1.8} c="green" o={0.9} taper={[0.2, 0.3]} />
        <Brush d="M258 356V332" w={1.5} c="green" o={0.8} taper={[0.2, 0.4]} />
        {reels.map((cy, r) => (
          <g key={cy}>
            <Brush
              pts={ptsOfCircle(223, cy - 5, 40, Math.PI * 1.02, Math.PI * 1.85)}
              w={6}
              c="gloss"
              o={0.32}
              taper={[0.35, 0.4]}
            />
            <Brush
              pts={ptsOfCircle(220, cy, 36)}
              w={2.8}
              c="gloss"
              o={0.72}
              loop={2}
              seed={r * 5 + 2}
            />
            <Brush
              pts={ptsOfCircle(220, cy, 26)}
              w={1.2}
              c="blue-light"
              o={0.35}
              loop={2}
              seed={r * 5 + 9}
            />
            <Brush pts={ptsOfCircle(220, cy, 6)} w={10} c="green" o={0.8} pressure={0.15} />
            <Brush pts={ptsOfCircle(221, cy + 1, 7, 0.2, 2.6)} w={2.2} c="green-deep" o={0.6} />
            <Brush
              d={`M144 ${cy - 1}Q220 ${cy - 3} 296 ${cy}`}
              w={2.4}
              c="cream"
              o={0.85}
              taper={[0.1, 0.2]}
            />
            <Brush
              d={`M152 ${cy + 4}Q220 ${cy + 3} 290 ${cy + 5}`}
              w={1.1}
              c="cream"
              o={0.7}
              taper={[0.2, 0.3]}
            />
          </g>
        ))}
        <Brush
          pts={ellPts(oval.cx, oval.cy, oval.rx + 1, oval.ry + 1, oval.rot, -2.2, 2.4)}
          w={2.4}
          c="blue-light"
          o={0.85}
          taper={[0.2, 0.3]}
        />
        <Brush
          pts={ellPts(oval.cx - 2, oval.cy, oval.rx + 5, oval.ry + 4, oval.rot, 1.2, 4.6)}
          w={2}
          c="gloss"
          o={0.8}
          taper={[0.3, 0.3]}
        />
        <Brush
          pts={ellPts(oval.cx + 2, oval.cy, oval.rx + 9, oval.ry + 7, oval.rot, 4.4, 6.6)}
          w={4.5}
          c="gloss"
          o={0.3}
          taper={[0.35, 0.35]}
        />
        {sprockets.map(([y, r], k) => (
          <g key={y}>
            <Brush
              pts={ptsOfCircle(100, y, r + 1, 3.6 + k, 3.6 + k + 5.5)}
              w={2.8}
              c="gloss"
              o={0.8}
              taper={[0.1, 0.5]}
            />
            {k % 2 === 0 && (
              <Brush pts={ptsOfCircle(100, y, r * 0.35)} w={r * 0.6} c="cream" o={0.55} />
            )}
          </g>
        ))}
      </g>

      {/* the reels, turning while the press runs */}
      {reels.map((cy, r) => (
        <g key={cy} className="w-turn" style={{ animationDuration: r === 0 ? "11s" : "8s" }}>
          <circle cx={220} cy={cy} r={34} fill="none" />
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k * Math.PI) / 3 + 0.3;
            return (
              <Brush
                key={k}
                pts={[
                  [220 + Math.cos(a) * 17, cy + Math.sin(a) * 17],
                  [220 + Math.cos(a + 0.12) * 31, cy + Math.sin(a + 0.12) * 31],
                ]}
                w={2}
                c="gloss"
                o={0.55}
                taper={[0.1, 0.6]}
                seed={k + r * 7 + 1}
              />
            );
          })}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const a = (k * Math.PI) / 4 + 0.2;
            return (
              <circle
                key={k}
                cx={220 + Math.cos(a) * 8}
                cy={cy + Math.sin(a) * 8}
                r={1.3}
                className="fill-w-deep"
                opacity={0.6}
              />
            );
          })}
          <circle cx={220} cy={cy} r={2.4} className="fill-w-deep" opacity={0.75} />
        </g>
      ))}

      {/* glass: long scratches of white, blue and cream across the window */}
      <g filter="url(#w-paint)">
        <Brush
          d="M192 374Q214 250 302 108"
          w={3}
          c="gloss"
          o={0.75}
          taper={[0.4, 0.35]}
          pressure={0.35}
        />
        <Brush d="M204 370Q228 250 310 118" w={2.2} c="blue-light" o={0.8} taper={[0.3, 0.4]} />
        <Brush d="M186 352Q212 240 286 116" w={1.2} c="cream" o={0.85} taper={[0.3, 0.3]} />
        <Brush d="M232 368Q262 300 270 214" w={1.6} c="gloss" o={0.6} taper={[0.3, 0.3]} />
        <Brush d="M106 364Q104 250 150 112" w={1.6} c="gloss" o={0.55} taper={[0.4, 0.4]} />
        <Brush d="M132 250L156 238" w={1.2} c="blue-light" o={0.7} taper={[0.2, 0.4]} />
        <Brush d="M130 258L162 246" w={0.9} c="gloss" o={0.6} taper={[0.2, 0.4]} />
        <Brush d="M154 330Q148 260 158 200" w={6} c="gloss" o={0.28} taper={[0.4, 0.4]} />
        <Brush d="M138 340Q146 300 150 270" w={1.2} c="cream" o={0.7} taper={[0.3, 0.3]} />
        <Brush d={rr(40, 60, 380, 350, 28)} w={4} c="label" loop={3} seed={3} pressure={0.35} />
        <Brush d={rr(41, 61, 378, 348, 27)} w={1.8} c="ink" o={0.9} loop={3} seed={11} />
        <Brush d="M421 96V384Q421 412 392 412H76" w={5} c="label" o={0.85} taper={[0.3, 0.2]} />
        <Brush d={rr(20, 172, 26, 120, 8)} w={2.6} c="label" loop={2} seed={5} />
        <Brush d={rr(20, 172, 26, 120, 8)} w={1.2} c="ink" o={0.85} loop={2} seed={8} />
        <Brush d={rr(74, 96, 252, 284, 6)} w={2.2} c="ink" o={0.85} loop={3} seed={13} />
        <Brush d={rr(344, 96, 52, 284, 5)} w={2} c="ink" o={0.85} loop={2} seed={17} />
        <Brush d={rr(112, 52, 236, 16, 5)} w={2.4} c="ink" loop={2} seed={19} />
        <Brush d="M118 61H342" w={3} c="deep" taper={[0.1, 0.1]} />
        {screws.map(([x, y], k) => (
          <g key={k}>
            <Brush pts={ptsOfCircle(x, y, 3.5)} w={7} c="deep" o={0.9} />
            <Brush
              pts={ptsOfCircle(x, y, 6.5)}
              w={2.6}
              c="gloss"
              o={0.9}
              loop={2}
              seed={k * 4 + 1}
            />
            <Brush pts={ptsOfCircle(x, y, 9, 0.2, 1.9)} w={2.2} c="label" o={0.8} />
          </g>
        ))}
        <Brush
          d="M47 112Q43 240 48 380"
          w={4}
          c="blue-light"
          o={0.95}
          taper={[0.3, 0.4]}
          pressure={0.4}
        />
        <Brush
          d="M57 100Q53 230 58 372"
          w={7}
          c="gloss"
          o={0.9}
          taper={[0.12, 0.55]}
          pressure={0.45}
        />
        <Brush d="M67 124Q64 210 67 300" w={4.4} c="gloss" o={0.62} taper={[0.2, 0.5]} />
        <Brush d="M66 318Q64 345 67 370" w={3} c="gloss" o={0.7} taper={[0.3, 0.4]} />
        <Brush d="M73 110V368" w={3} c="gloss" o={0.9} taper={[0.1, 0.4]} pressure={0.35} />
        <Brush d="M61 150Q72 250 61 352" w={1.4} c="cream" o={0.95} taper={[0.3, 0.3]} />
        <Brush d="M52 212H72M54 218H70" w={1.3} c="cream" o={0.85} taper={[0.1, 0.3]} />
        <Brush d="M47 106Q46 70 80 63" w={4.4} c="gloss" o={0.92} taper={[0.2, 0.5]} />
        <Brush d="M46 360Q48 398 78 404" w={3.6} c="blue-light" o={0.9} taper={[0.3, 0.3]} />
        <Brush d="M90 65Q200 62 310 64" w={2.6} c="gloss" o={0.7} taper={[0.2, 0.5]} />
        <Brush d="M100 72H384" w={1.4} c="blue-light" o={0.75} taper={[0.3, 0.3]} />
        <Brush d="M80 99H320" w={2.6} c="gloss" o={0.85} taper={[0.1, 0.5]} />
        <Brush d="M80 399Q220 402 384 398" w={2.2} c="gloss" o={0.6} taper={[0.3, 0.4]} />
        <Brush d="M92 391H340" w={1.2} c="cream" o={0.7} taper={[0.3, 0.3]} />
        <Brush d="M411 110Q414 240 410 370" w={2.4} c="blue-light" o={0.55} taper={[0.3, 0.3]} />
        <Brush d="M405 120V352" w={1.8} c="gloss" o={0.6} taper={[0.2, 0.4]} />
        <Brush d="M341 106V370" w={2.4} c="gloss" o={0.75} taper={[0.1, 0.4]} />
        <Brush d="M405 70Q416 78 417 104" w={2.6} c="gloss" o={0.8} taper={[0.2, 0.5]} />
        {/* rails lit on their left edge */}
        <Brush d="M81 106V370" w={2.6} c="gloss" o={0.9} taper={[0.05, 0.4]} />
        <Brush d="M115 112V364" w={2.2} c="gloss" o={0.8} taper={[0.1, 0.5]} />
        <Brush d="M174 110V368" w={3.4} c="gloss" o={0.92} taper={[0.05, 0.3]} pressure={0.35} />
        <Brush d="M262 112V366" w={2.6} c="gloss" o={0.85} taper={[0.1, 0.4]} />
        <Brush d="M316 110V366" w={2.2} c="gloss" o={0.75} taper={[0.2, 0.4]} />
        <Brush d="M180 108H258" w={2.4} c="gloss" o={0.8} taper={[0.1, 0.5]} />
        <Brush d="M348 100H392" w={2.4} c="gloss" o={0.85} taper={[0.1, 0.4]} />
        <Brush d="M118 56H340" w={1.4} c="blue-light" o={0.6} taper={[0.2, 0.3]} />
        <Brush d="M120 66H344" w={1.6} c="gloss" o={0.75} taper={[0.2, 0.5]} />
        {/* label corners */}
        <Brush d="M355 124V108H368" w={2.6} c="gloss" o={0.92} taper={[0.3, 0.3]} pressure={0.1} />
        <Brush d="M385 352V366H372" w={2.6} c="gloss" o={0.92} taper={[0.3, 0.3]} pressure={0.1} />
        {/* side button */}
        <Brush d="M25 182Q23 232 26 282" w={2.4} c="gloss" o={0.9} taper={[0.2, 0.4]} />
        <Brush d="M32 190V270" w={1.2} c="blue-light" o={0.8} taper={[0.3, 0.3]} />
        {/* the jack and the start of the cord */}

        <Brush d="M342 414V438Q342 444 336 446" w={7} c="ink-soft" o={0.3} taper={[0.1, 0.3]} />
        {[418, 423, 428, 433, 438].map((y) => (
          <Brush key={y} d={`M322 ${y}H345`} w={1.2} c="ink-soft" o={0.85} taper={[0.15, 0.3]} />
        ))}
        <Brush
          d="M318 412H348V430Q348 444 340 448H326Q318 444 318 430Z"
          w={2}
          c="ink"
          loop={2}
          seed={29}
        />
        <Brush d="M322 415Q320 428 324 442" w={1.8} c="gloss" o={0.9} taper={[0.2, 0.4]} />
        <Brush d={rr(328, 448, 10, 6, 1.5)} w={1.8} c="ink" loop={2} seed={31} />
        <Brush d="M333 452V457" w={3} c="ink" taper={[0, 0.1]} />
        {reels.map((cy) => (
          <g key={cy}>
            <Brush pts={ptsOfCircle(202, cy - 18, 1.6)} w={3.6} c="gloss" o={0.95} />
            <Brush pts={ptsOfCircle(212, cy - 6, 1)} w={2.2} c="gloss" o={0.8} />
          </g>
        ))}
        <Brush pts={ptsOfCircle(57, 78, 1.4)} w={3} c="gloss" />
        <Brush pts={ptsOfCircle(58, 388, 1.2)} w={2.6} c="gloss" o={0.9} />
        <Brush pts={ptsOfCircle(160, 140, 1)} w={2.4} c="green" o={0.9} />
        <Brush pts={ptsOfCircle(300, 344, 1.2)} w={2.6} c="green" o={0.85} />
        <Brush pts={ptsOfCircle(92, 360, 0.8)} w={2} c="cream" o={0.9} />
      </g>

      {/* gears and lamp of the running press */}
      <g className="w-turn-slow">
        <Fill d={gear(110, 395, 9, 9, 3)} c="gloss" o={0.3} />
        <Brush d={gear(110, 395, 9, 9, 3)} w={1.5} c="ink" loop={2} seed={37} pressure={0.15} />
        <Line d={circle(110, 395, 3)} w={1.2} />
      </g>
      <g className="w-turn" style={{ animationDirection: "reverse", animationDuration: "15s" }}>
        <Brush
          d={gear(134, 393, 6, 7, 2.5)}
          w={1.3}
          c="ink-soft"
          loop={2}
          seed={41}
          pressure={0.15}
        />
      </g>
      <g filter="url(#w-wash)">
        <Fill d={circle(370, 395, 7)} c="green" o={0.35} />
      </g>
      <circle cx={370} cy={395} r={4.5} className="fill-w-green w-breathe" />

      {/* the name on the spine of the label: FUMA, a dot, PRESS */}
      <VerticalText
        x={370}
        y={152}
        glyphs={["F", "U", "M", "A", "•", "P", "R", "E", "S", "S"]}
        size={12}
        gap={6.4}
        className="fill-w-gloss"
        style={{ fontFamily: "var(--default-font-family)", letterSpacing: 0 }}
      />
    </svg>
  );
}

export { Jack } from "./plugs";
export { Sheet } from "./sheet";

/** the socket on the wall, drawn on its own */
function SocketSvg() {
  return (
    <svg viewBox="0 0 80 74" className="block h-18.5 w-20" aria-hidden>
      <g filter="url(#w-flat)">
        <path d={cast(rr(6, 6, 54, 54, 9), 14, 10)} className="fill-w-shadow" />
      </g>
      <g filter="url(#w-wash)">
        <path d={rr(6, 6, 54, 54, 9)} className="fill-w-indigo-wash" opacity={0.62} />
        <path
          d="M60 18V51Q60 60 51 60H16Q9 60 7 54Q30 55 44 53Q55 52 56 42V12Q60 14 60 18Z"
          className="fill-w-deep"
          opacity={0.3}
        />
        <path
          d="M9 18Q10 9 19 8H48Q26 11 17 14Q12 17 12 26V46Q9 32 9 18Z"
          className="fill-w-gloss"
          opacity={0.25}
        />
      </g>
      <g filter="url(#w-wash-dense)">
        <path d={rr(24, 19, 18, 28, 3)} className="fill-w-deep" />
      </g>
      <g filter="url(#w-ink)">
        <Sketch d={rr(6, 6, 54, 54, 9)} w={1.4} />
        <Line d={rr(11, 11, 44, 44, 6)} w={0.6} c="ink-soft" o={0.8} />
        <Line d={rr(24, 19, 18, 28, 3)} w={1.2} />
        <Line d={rr(21, 16, 24, 34, 4)} w={0.7} c="ink-soft" />
        <Line d="M30 24V31M36 24V31" w={1} c="gloss" o={0.75} />
        <Line d="M26 44H40" w={0.8} c="blue-light" o={0.6} />
        {[
          [14, 14],
          [52, 52],
        ].map(([x = 0, y = 0]) => (
          <g key={x}>
            <Line d={circle(x, y, 3)} w={0.9} />
            <Line d={`M${x - 2} ${y + 1.4}L${x + 2} ${y - 1.4}`} w={0.7} />
          </g>
        ))}
        <Line d="M12 22Q10 34 13 50" w={1} c="gloss" o={0.75} />
        <Line d="M62 20Q63 36 61 52" w={1.6} c="blue-light" o={0.45} />
      </g>
      <circle cx={33} cy={53} r={1.6} className="fill-w-green" />
    </svg>
  );
}

/** the loose plug at the end of the cord */
/**
 * The end of the cord: its plug pushed into the socket on the wall, and the socket's lamp lit. The plug stands in the
 * socket's slot, the cord leaving it upward.
 */
export function Socket({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-18.5 w-20", className)} aria-hidden>
      <SocketSvg />
      {/* the plug's body covers the slot down to its lower end */}
      <div className="absolute top-0 left-8.25 flex -translate-x-1/2 -translate-y-0.5 flex-col items-center">
        <span data-cord="end" className="size-px" />
        <PlugSvg />
      </div>
    </div>
  );
}

/** vertical type between thin rules, the chapter mark of a section */
export function Mark({ children, gloss }: { children: string; gloss?: string }) {
  return (
    <>
      <div className="flex items-center gap-3 text-w-muted xl:hidden">
        <span className="h-px w-8 bg-w-rule" />
        <span className="font-serif text-base text-w-ink">{children}</span>
        {gloss && <span className="font-serif text-base italic">{gloss}</span>}
      </div>
      <div className="hidden flex-col items-center gap-5 pt-2 xl:flex" aria-hidden>
        <span className="h-28 w-px bg-w-rule" />
        <span className="tate font-serif text-2xl leading-none tracking-spine text-w-ink-soft">
          {children}
        </span>
        <span className="h-28 w-px bg-w-rule" />
        {gloss && <span className="sideways font-serif text-sm text-w-muted italic">{gloss}</span>}
      </div>
    </>
  );
}
