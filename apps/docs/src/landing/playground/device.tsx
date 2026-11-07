import { Brush, Fill, Line, Sketch, rr, cast } from "../pen";
import { device, glass } from "./device-rect";

/*
 * The preview's device: an indigo case with a dark glass, painted like the rack and the terminal. Rendered on the
 * server and handed to the playground, so none of the brush code reaches the browser. The live preview sits in the
 * glass (`glass`), and the address shows on the plaque, both laid over this drawing in HTML.
 */

const { w: W, h: H } = device;
const body = { x: 10, y: 8, w: 620, h: 424, r: 16 };
const screws: [number, number][] = [
  [24, 22],
  [616, 22],
  [24, 418],
  [616, 418],
];
const vents = [540, 548, 556, 564, 572, 580];

export function PreviewDevice() {
  const g = glass;
  const bx = body.x;
  const by = body.y;
  const br = body.x + body.w;
  const bb = body.y + body.h;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" aria-hidden>
      {/* 1. the flat shadow on the page, and the feet */}
      <g filter="url(#w-flat)">
        <path d={cast(rr(bx, by, body.w, body.h, body.r), 24, 16)} className="fill-w-shadow" />
      </g>
      <g filter="url(#w-wash)">
        <Fill
          d={`${rr(70, bb - 4, 60, 12, 3)}${rr(W - 130, bb - 4, 60, 12, 3)}`}
          c="deep"
          o={0.8}
        />
      </g>

      {/* 2. the case: paper ground, the indigo wash, light on the near side, shade on the far side */}
      <Fill d={rr(bx + 2, by + 2, body.w - 4, body.h - 4, body.r)} c="paper" />
      <g filter="url(#w-wash)">
        <Fill d={rr(bx, by, body.w, body.h, body.r)} c="indigo-wash" o={0.66} />
        <Fill
          d={`M${bx + 4} ${by + 40}Q${bx + 3} ${by + 6} ${bx + 40} ${by + 4}H${bx + 220}Q${bx + 60} ${by + 16} ${bx + 12} ${by + 120}Z`}
          c="gloss"
          o={0.16}
        />
        <Fill
          d={`M${br - 16} ${by + 4}Q${br - 2} ${by + 6} ${br - 2} ${by + 24}V${bb - 18}Q${br - 2} ${bb - 2} ${br - 20} ${bb - 2}H${bx + 40}Q${br - 40} ${bb - 10} ${br - 10} ${bb - 30}Z`}
          c="deep"
          o={0.28}
        />
        {/* the glass sits in a recess */}
        <Fill d={rr(g.x - 7, g.y - 7, g.w + 14, g.h + 14, 7)} c="deep" o={0.42} />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(g.x - 2, g.y - 2, g.w + 4, g.h + 4, 3)} c="deep" />
        {vents.map((x) => (
          <Fill key={x} d={rr(x, 21, 3, 16, 1.5)} c="deep" />
        ))}
      </g>

      {/* 3. paint masses and the rim, in two passes */}
      <g filter="url(#w-paint)">
        <Brush
          d={`M${bx + 6} ${by + 18}V${bb - 18}`}
          w={7}
          c="indigo-wash"
          taper={[0.04, 0.04]}
          pressure={0.15}
        />
        <Brush
          d={`M${bx + 7.5} ${by + 22}V${bb - 22}`}
          w={3}
          c="gloss"
          o={0.35}
          taper={[0.06, 0.1]}
        />
        <Brush
          d={`M${br - 5} ${by + 20}V${bb - 16}`}
          w={6}
          c="label"
          o={0.75}
          taper={[0.04, 0.04]}
        />
        <Brush
          d={`M${bx + 24} ${by + 9}H${br - 26}`}
          w={6}
          c="indigo-wash"
          o={0.9}
          taper={[0.04, 0.04]}
        />
        <Brush
          d={`M${bx + 26} ${by + 5}H${br - 40}`}
          w={2.6}
          c="gloss"
          o={0.35}
          taper={[0.06, 0.1]}
        />
        <Brush
          d={`M${bx + 30} ${bb - 6}H${br - 30}`}
          w={6}
          c="label"
          o={0.55}
          taper={[0.04, 0.04]}
        />
        <Brush
          d={rr(bx, by, body.w, body.h, body.r)}
          w={3.4}
          c="label"
          loop={2}
          seed={61}
          pressure={0.32}
        />
        <Brush
          d={rr(bx + 0.6, by + 0.6, body.w - 1.2, body.h - 1.2, body.r - 0.5)}
          w={1.6}
          c="ink"
          o={0.9}
          loop={2}
          seed={67}
        />
      </g>

      {/* 4. contours: the recess, the glass edge, the plaque, the lamp and screws */}
      <g filter="url(#w-ink)">
        <Sketch d={rr(g.x - 7, g.y - 7, g.w + 14, g.h + 14, 7)} w={1.1} />
        <Line d={rr(g.x - 2, g.y - 2, g.w + 4, g.h + 4, 3)} w={0.9} />
        <Line d={`M${g.x - 4} ${g.y + g.h + 5}H${g.x + g.w + 4}`} w={1} c="gloss" o={0.45} />
        <Line d={`M${bx + 14} ${by + 3.2}H${br - 16}`} w={0.9} c="gloss" o={0.7} />
        {screws.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <Line d={`M${x - 3.6} ${y}a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0`} w={1} />
            <Line d={`M${x - 2.2} ${y + 1.4}L${x + 2.2} ${y - 1.4}`} w={0.9} />
          </g>
        ))}
        {vents.map((x) => (
          <Line key={x} d={`M${x + 1.5} 22V36`} w={0.5} c="blue-light" o={0.6} />
        ))}
      </g>

      {/* the address plate, its text laid over in HTML */}
      <g filter="url(#w-wash)">
        <Fill d={rr(203, 18, 240, 24, 4)} c="deep" o={0.3} />
        <Fill d={rr(200, 15, 240, 24, 4)} c="sheet" o={0.97} />
      </g>
      <g filter="url(#w-ink)">
        <Sketch d={rr(200, 15, 240, 24, 4)} w={1} />
        <Line d="M205 18H400" w={0.7} c="gloss" o={0.9} />
        <Line
          d="M206 27a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0M430.4 27a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0"
          w={0.8}
        />
      </g>

      {/* a pale green lamp: the preview is on */}
      <g filter="url(#w-wash)">
        <Fill d="M52 29a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" c="green" />
      </g>
      <g filter="url(#w-ink)">
        <Line d="M51 29a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" w={1} />
        <Line d="M54.4 26.6Q56 25.2 58 25.6" w={0.8} c="gloss" o={0.9} />
      </g>
    </svg>
  );
}
