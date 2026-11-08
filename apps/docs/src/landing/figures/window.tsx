import { Brush, Fill, circle, ptsOfCircle, rr, type Paint } from "../pen";

/*
 * figure: the ending, a closed window on a rainy afternoon, seen from a quiet room.
 *
 * Two stacked SVGs of the same viewBox: `WindowOutside`, the town behind the glass, and
 * `WindowFront`, the glass, the frame and the room. The page puts the moving rain between them.
 */

export const VIEWBOX = { w: 640, h: 520 };

/** the glass inside the casing */
export const glass = { x: 74, y: 42, w: 492, h: 338 };

/** the panes between the sashes, rails and muntins */
export const panes = [
  { x: 85, y: 52, w: 227, h: 104 },
  { x: 85, y: 162, w: 227, h: 204 },
  { x: 328, y: 52, w: 228, h: 104 },
  { x: 328, y: 162, w: 228, h: 204 },
];

/**
 * The top of the windowsill: things lie on the line `y` between `x0` and `x1`, left of the cup.
 */
export const sill = { y: 410, x0: 44, x1: 430 };

/** where the teru teru bozu hangs, in front of the upper right pane */
const doll = { x: 522, y: 96 };

const cup = { x: 512, top: 356, bottom: 407 };

/** the street lamp on the pole */
const lamp = { x: 466, y: 250 };

function seeded(seed: number) {
  let s = seed * 7919 + 13;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/* shapes, every one wound clockwise so a path of several never cuts holes */

type P = [number, number];

function poly(pts: readonly P[]) {
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

function rect(x: number, y: number, w: number, h: number) {
  return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
}

function ellipse(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
}

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

interface House {
  roof: P[];
  walls: P[][];
  /** the wall in shade, if any */
  shade?: P[];
  /** the slope of tiles: eave left, ridge left, ridge right, eave right */
  slope?: [P, P, P, P];
  /** the eave, as a line */
  eave: [P, P];
  /** the ridge, as a line */
  ridge?: [P, P];
}

/** a hipped roof seen from the long side */
function hip(x: number, y: number, w: number, h: number, e: number, floor: number): House {
  const roof: P[] = [
    [x - e, y],
    [x + w * 0.24, y - h],
    [x + w * 0.76, y - h],
    [x + w + e, y],
  ];
  return {
    roof,
    walls: [
      [
        [x, y],
        [x + w, y],
        [x + w, floor],
        [x, floor],
      ],
    ],
    slope: [roof[0]!, roof[1]!, roof[2]!, roof[3]!],
    eave: [roof[0]!, roof[3]!],
    ridge: [roof[1]!, roof[2]!],
  };
}

/** a hip-and-gable roof: the slope breaks under a short gable */
function irimoya(x: number, y: number, w: number, h: number, e: number, floor: number): House {
  const roof: P[] = [
    [x - e, y],
    [x + w * 0.08, y - h * 0.5],
    [x + w * 0.14, y - h],
    [x + w * 0.86, y - h],
    [x + w * 0.92, y - h * 0.5],
    [x + w + e, y],
  ];
  return {
    roof,
    walls: [
      [
        [x, y],
        [x + w, y],
        [x + w, floor],
        [x, floor],
      ],
    ],
    slope: [roof[0]!, roof[2]!, roof[3]!, roof[5]!],
    eave: [roof[0]!, roof[5]!],
    ridge: [roof[2]!, roof[3]!],
  };
}

/** a gabled house with its gable toward us, the slope running back on the right */
function gable(
  x: number,
  y: number,
  w: number,
  h: number,
  e: number,
  d: number,
  r: number,
  floor: number,
): House {
  const apex: P = [x + w / 2, y - h];
  const roof: P[] = [
    apex,
    [apex[0] + d, apex[1] - r],
    [x + w + e + d, y + 2 - r],
    [x + w + e, y + 2],
  ];
  return {
    roof,
    walls: [
      [
        [x, y + 1],
        [apex[0], apex[1] + 2],
        [x + w, y + 1],
        [x + w, floor],
        [x, floor],
      ],
    ],
    shade: [
      [x + w, y + 1],
      [x + w + d, y + 1 - r],
      [x + w + d, floor],
      [x + w, floor],
    ],
    slope: [roof[3]!, roof[0]!, roof[1]!, roof[2]!],
    eave: [
      [x - e, y + 2],
      [x + w + e, y + 2],
    ],
    ridge: [roof[0]!, roof[1]!],
  };
}

/** a lean-to: one slope falling to the right */
function shed(x: number, y: number, w: number, h: number, e: number, floor: number): House {
  const roof: P[] = [
    [x - e, y - h],
    [x + w + e, y],
    [x + w + e, y + 2.5],
    [x - e, y - h + 2.5],
  ];
  return {
    roof,
    walls: [
      [
        [x, y - h + 2],
        [x + w, y + 1],
        [x + w, floor],
        [x, floor],
      ],
    ],
    eave: [roof[3]!, roof[2]!],
  };
}

/** a flat-roofed block of flats */
function block(x: number, top: number, w: number, floor: number): House {
  return {
    roof: [
      [x - 1, top - 2],
      [x + w + 1, top - 2],
      [x + w + 1, top + 1],
      [x - 1, top + 1],
    ],
    walls: [
      [
        [x, top],
        [x + w, top],
        [x + w, floor],
        [x, floor],
      ],
    ],
    eave: [
      [x - 1, top + 1],
      [x + w + 1, top + 1],
    ],
  };
}

const union = (houses: House[], part: (h: House) => (P[] | undefined)[]) =>
  houses
    .flatMap(part)
    .filter((p): p is P[] => !!p)
    .map(poly)
    .join("");

/** the rows and columns of tiles on a slope */
function tileLines(slope: [P, P, P, P], cols: number, rows: number) {
  const [a, b, c, d] = slope;
  const out: { d: string; kind: "col" | "row" }[] = [];
  for (let i = 1; i < cols; i++) {
    const s = i / cols;
    const p = lerp(a, d, s);
    const q = lerp(b, c, Math.min(1, Math.max(0, (s - 0.04) * 1.08)));
    out.push({
      d: `M${q[0].toFixed(1)} ${q[1].toFixed(1)}L${p[0].toFixed(1)} ${p[1].toFixed(1)}`,
      kind: "col",
    });
  }
  for (let j = 1; j < rows; j++) {
    const t = j / rows;
    const p = lerp(a, b, t);
    const q = lerp(d, c, t);
    out.push({
      d: `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`,
      kind: "row",
    });
  }
  return out;
}

/**
 * A layer of the town: an opaque ground the color of the mist, so it hides what is behind it, then
 * its own darker tone, walls lighter than roofs.
 */
function Layer({
  houses,
  wall,
  roof,
  blue = 0,
}: {
  houses: House[];
  wall: number;
  roof: number;
  blue?: number;
}) {
  const all = union(houses, (h) => [h.roof, ...h.walls, h.shade]);
  return (
    <>
      <Fill d={all} c="sheet" />
      <Fill d={all} c="blue-light" o={0.26} />
      <Fill d={all} c="deep" o={0.12} />
      <Fill d={all} c="gloss" o={0.14} />
      {blue > 0 && <Fill d={all} c="blue-light" o={blue} />}
      <Fill d={union(houses, (h) => h.walls)} c="deep" o={wall} />
      <Fill d={union(houses, (h) => [h.shade])} c="deep" o={wall + 0.08} />
      <Fill d={union(houses, (h) => [h.roof])} c="deep" o={roof} />
    </>
  );
}

/* the town, far to near */

/** the farthest roofs, only a ragged line in the mist */
const farSkyline = (() => {
  const rand = seeded(5);
  const out: string[] = [];
  let x = 66;
  while (x < 572) {
    const w = 9 + rand() * 22;
    const base = 232 + rand() * 6;
    if (rand() < 0.22) {
      const top = base - 12 - rand() * 16;
      out.push(rect(x, top, w * 0.8, 290 - top));
    } else {
      const h = 4 + rand() * 6;
      out.push(
        poly([
          [x, base],
          [x + w * 0.26, base - h],
          [x + w * 0.74, base - h],
          [x + w, base],
          [x + w, 290],
          [x, 290],
        ]),
      );
    }
    x += w * (0.7 + rand() * 0.25);
  }
  return out.join("");
})();

const F3 = 310;
const layer3: House[] = [
  hip(66, 254, 44, 9, 4, F3),
  gable(118, 257, 26, 12, 3, 12, 3, F3),
  hip(164, 252, 48, 10, 5, F3),
  irimoya(222, 258, 56, 12, 5, F3),
  shed(286, 261, 28, 7, 3, F3),
  hip(330, 255, 46, 10, 4, F3),
  gable(384, 259, 24, 11, 3, 14, 4, F3),
  block(424, 226, 42, F3),
  hip(476, 254, 40, 10, 4, F3),
  gable(526, 258, 22, 11, 3, 14, 3, F3),
];

const F2 = 336;
const mansion = block(74, 262, 60, F2);
const narrow = block(418, 272, 38, F2);
const flats = block(474, 256, 96, F2);
const layer2: House[] = [
  mansion,
  gable(146, 292, 42, 20, 5, 30, 5, F2),
  hip(230, 298, 76, 16, 7, F2),
  irimoya(334, 294, 76, 18, 7, F2),
  narrow,
  flats,
];

function OutsideContent() {
  return (
    <svg
      x={glass.x}
      y={glass.y}
      width={glass.w}
      height={glass.h}
      viewBox={`${glass.x} ${glass.y} ${glass.w} ${glass.h}`}
      overflow="hidden"
    >
      {/* the sky: low cloud, heavier above, a paler band of light over the roofs */}
      <g filter="url(#w-bloom)">
        <Fill d={rect(40, 10, 560, 400)} c="sheet" />
        <Fill d={rect(40, 10, 560, 400)} c="blue-light" o={0.26} />
        <Fill d={rect(40, 10, 560, 400)} c="deep" o={0.15} />
        <Fill d={rect(40, 10, 560, 80)} c="deep" o={0.08} />
        <Fill d={rect(40, 10, 560, 130)} c="deep" o={0.05} />
        <Fill d={rect(40, 10, 560, 170)} c="deep" o={0.03} />
        <Fill d={rect(40, 168, 560, 90)} c="gloss" o={0.12} />
        <Fill d={rect(40, 190, 560, 56)} c="gloss" o={0.12} />
        <Fill d={rect(40, 206, 560, 30)} c="cream" o={0.08} />
        {/* clouds, drifting a little downhill */}
        <Brush d="M60 70Q220 56 380 78Q470 88 590 70" w={40} c="deep" o={0.09} />
        <Brush d="M110 96Q190 84 280 100" w={18} c="gloss" o={0.12} />
        <Brush d="M140 120Q300 106 460 126" w={26} c="deep" o={0.08} />
        <Brush d="M70 152Q170 140 260 152" w={20} c="gloss" o={0.18} />
        <Brush d="M300 140Q380 132 450 144" w={12} c="deep" o={0.07} />
        <Brush d="M360 164Q470 152 590 166" w={22} c="gloss" o={0.16} />
        <Brush d="M200 188Q330 178 470 192" w={16} c="gloss" o={0.14} />
        <Brush d="M420 104Q500 94 590 112" w={30} c="deep" o={0.07} />
        <Brush d="M60 196Q120 190 180 198" w={12} c="deep" o={0.05} />
      </g>

      {/* hills behind the town, nearly gone in the rain */}
      <g filter="url(#w-haze-far)">
        <Fill
          d="M60 226Q100 206 150 210Q200 198 250 214Q290 206 330 216Q380 200 430 208Q480 196 530 212Q560 206 590 214V300H60Z"
          c="deep"
          o={0.06}
        />
        <Fill
          d="M60 226Q100 206 150 210Q200 198 250 214Q290 206 330 216Q380 200 430 208Q480 196 530 212Q560 206 590 214V300H60Z"
          c="blue-light"
          o={0.1}
        />
        {/* the farthest roofs */}
        <Fill d={farSkyline} c="deep" o={0.1} />
        <Fill d={farSkyline} c="blue-light" o={0.14} />
        {/* mist lying over them */}
        <Fill d={rect(40, 236, 560, 70)} c="gloss" o={0.1} />
      </g>

      {/* the town beyond the lane, blue with distance */}
      <g filter="url(#w-haze)">
        <Layer houses={layer3} wall={0.1} roof={0.22} blue={0.08} />
        {/* the windows of the far flats, one of them lit */}
        {[234, 246, 258, 270].flatMap((y) =>
          [430, 440, 450, 460].map((x) => (
            <Fill key={`${x}-${y}`} d={rect(x - 2, y, 5, 4)} c="deep" o={0.14} />
          )),
        )}
        <Fill d={rect(438, 246, 5, 4)} c="cream" />
        <Brush d="M422 225H468" w={2} c="deep" o={0.2} taper={[0.1, 0.1]} />
        {layer3.map((h, i) => (
          <Brush
            key={i}
            pts={[h.eave[0], lerp(h.eave[0], h.eave[1], 0.5), h.eave[1]]}
            w={1.4}
            c="deep"
            o={0.22}
            taper={[0.1, 0.1]}
          />
        ))}
        {layer3.map((h, i) =>
          h.slope ? (
            <Brush
              key={i}
              pts={[lerp(h.slope[0], h.slope[1], 0.45), lerp(h.slope[3], h.slope[2], 0.45)]}
              w={2}
              c="gloss"
              o={0.18}
              taper={[0.3, 0.3]}
            />
          ) : null,
        )}
        {/* a mist rising off the wet roofs */}
        <Fill d={rect(40, 268, 560, 60)} c="gloss" o={0.07} />
        <Fill d={rect(40, 280, 560, 40)} c="blue-light" o={0.06} />
      </g>
      <g filter="url(#w-bloom)">
        <Fill d={ellipse(441, 248, 10, 7)} c="cream" o={0.4} />
      </g>

      {/* the houses across the lane */}
      <g filter="url(#w-paint)">
        <Layer houses={layer2} wall={0.18} roof={0.4} />
        {/* the walls, laid with a dry brush */}
        {layer2.flatMap((h, i) => {
          const xs = h.walls[0]!.map((p) => p[0]);
          const ys = h.walls[0]!.map((p) => p[1]);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          const y0 = Math.max(...ys.filter((y) => y < F2)) + 2;
          return [0.2, 0.45, 0.7].map((t, k) => (
            <Brush
              key={`${i}-${k}`}
              d={`M${(x0 + (x1 - x0) * t).toFixed(1)} ${y0}V${F2 - 18}`}
              w={(x1 - x0) * 0.22}
              c={k === 1 ? "deep" : "gloss"}
              o={k === 1 ? 0.05 : 0.08}
              taper={[0.1, 0.4]}
              pressure={0.3}
            />
          ));
        })}
        {/* the light on the wet tiles, then the tiles */}
        {layer2.map((h, i) =>
          h.slope ? (
            <g key={i}>
              <Brush
                pts={[lerp(h.slope[0], h.slope[1], 0.3), lerp(h.slope[3], h.slope[2], 0.3)]}
                w={5}
                c="gloss"
                o={0.16}
                taper={[0.3, 0.3]}
              />
              <Brush
                pts={[lerp(h.slope[0], h.slope[1], 0.75), lerp(h.slope[3], h.slope[2], 0.75)]}
                w={3}
                c="gloss"
                o={0.1}
                taper={[0.3, 0.3]}
              />
              {tileLines(
                h.slope,
                Math.round(
                  Math.hypot(h.slope[3][0] - h.slope[0][0], h.slope[3][1] - h.slope[0][1]) / 4,
                ),
                4,
              ).map((l, k) => (
                <Brush
                  key={k}
                  d={l.d}
                  w={l.kind === "col" ? 0.7 : 0.6}
                  c={l.kind === "col" ? "deep" : "gloss"}
                  o={l.kind === "col" ? 0.22 : 0.16}
                  taper={[0.1, 0.1]}
                  pressure={0.1}
                />
              ))}
            </g>
          ) : null,
        )}
        {/* eaves, deep in shade beneath, and the ridges */}
        {layer2.map((h, i) => (
          <g key={i}>
            <Brush
              pts={[h.eave[0], lerp(h.eave[0], h.eave[1], 0.5), h.eave[1]]}
              w={2.2}
              c="deep"
              o={0.5}
              taper={[0.05, 0.08]}
              pressure={0.15}
            />
            <Brush
              pts={[
                [h.eave[0][0] + 6, h.eave[0][1] + 3],
                [h.eave[1][0] - 6, h.eave[1][1] + 3],
              ]}
              w={3}
              c="deep"
              o={0.14}
              taper={[0.2, 0.2]}
            />
            {h.ridge && (
              <Brush
                pts={[h.ridge[0], h.ridge[1]]}
                w={2.4}
                c="deep"
                o={0.45}
                taper={[0.05, 0.05]}
                pressure={0.1}
              />
            )}
          </g>
        ))}
        {/* the bargeboards of the gable */}
        <Brush d="M141 294L167 272L193 294" w={1.6} c="deep" o={0.5} taper={[0.05, 0.05]} />
        <Fill d={rect(160, 300, 9, 8)} c="deep" o={0.28} />
        <Brush d="M350 306H398" w={1.2} c="deep" o={0.28} taper={[0.1, 0.1]} />
        <Fill d={rect(252, 304, 16, 7)} c="deep" o={0.24} />
        <Fill d={rect(276, 304, 14, 7)} c="deep" o={0.24} />

        {/* the block of flats on the left: balconies, and a window lit */}
        {[278, 296, 314].map((y) => (
          <g key={y}>
            <Fill d={rect(74, y, 60, 6)} c="deep" o={0.16} />
            <Brush d={`M74 ${y}H134`} w={1.2} c="gloss" o={0.3} taper={[0.05, 0.05]} />
            <Fill d={rect(80, y - 11, 10, 9)} c="deep" o={0.22} />
            <Fill d={rect(100, y - 11, 10, 9)} c="deep" o={0.22} />
            <Fill d={rect(120, y - 11, 9, 9)} c="deep" o={0.22} />
          </g>
        ))}
        <Fill d={rect(100, 285, 10, 9)} c="cream" o={0.95} />
        <Brush d="M100 290H110" w={1} c="deep" o={0.25} />
        <Brush d="M73 262V336" w={1.6} c="deep" o={0.3} taper={[0.05, 0.05]} />

        {/* a narrow house of three floors: laundry poles on its balcony, a towel left out */}
        <Fill d={rect(422, 278, 10, 8)} c="deep" o={0.24} />
        <Fill d={rect(440, 278, 10, 8)} c="deep" o={0.24} />
        <Fill d={rect(416, 300, 42, 8)} c="deep" o={0.2} />
        <Brush d="M414 292H460" w={0.9} c="deep" o={0.55} taper={[0.05, 0.05]} />
        <Brush d="M414 295H460" w={0.8} c="deep" o={0.45} taper={[0.05, 0.05]} />
        <Brush d="M416 292V300M458 292V300" w={0.8} c="deep" o={0.5} />
        <Fill d="M444 292.5H452L451.5 302Q448 303 444.4 301.6Z" c="gloss" o={0.55} />
        <Brush d="M445 296V301" w={0.7} c="deep" o={0.2} />

        {/* the flats on the right: a water tank on the roof, a fire ladder down the side */}
        <Fill d={rect(526, 240, 22, 12)} c="deep" o={0.42} />
        <Brush d="M526 240H548" w={1.2} c="gloss" o={0.3} taper={[0.05, 0.05]} />
        <Brush d="M533 241V251M540 241V251M527 246H547" w={0.6} c="gloss" o={0.18} />
        <Brush d="M529 252V256M545 252V256" w={1.2} c="deep" o={0.5} />
        <Brush d="M478 252H566" w={1} c="deep" o={0.35} />
        <Brush d="M478 249V255M498 249V255M518 249V255M556 249V255" w={0.8} c="deep" o={0.3} />
        {[268, 286, 304, 322].map((y) => (
          <g key={y}>
            <Fill d={rect(474, y + 6, 96, 5)} c="deep" o={0.14} />
            <Brush d={`M474 ${y + 6}H570`} w={1} c="gloss" o={0.24} taper={[0.05, 0.05]} />
            {[486, 506, 526, 546].map((x) => (
              <Fill key={x} d={rect(x, y - 6, 12, 10)} c="deep" o={0.2} />
            ))}
          </g>
        ))}
        <Fill d={rect(506, 280, 12, 10)} c="cream" o={0.3} />
        <Brush d="M477 258V336M482 258V336" w={0.9} c="deep" o={0.55} taper={[0.02, 0.02]} />
        <Brush
          d={Array.from({ length: 19 }, (_, k) => `M477 ${260 + k * 4}H482`).join("")}
          w={0.7}
          c="deep"
          o={0.45}
        />
        <Brush d="M474 256V336" w={1.4} c="deep" o={0.35} taper={[0.02, 0.02]} />

        {/* a garden pine over the wall, heavy with rain */}
        <Brush
          d="M214 318Q213 306 218 296Q221 290 226 287"
          w={2.4}
          c="deep"
          o={0.6}
          taper={[0.05, 0.3]}
        />
        {treeDabs.map(({ x, y, l, w, light }, i) => (
          <Brush
            key={i}
            d={`M${(x - l / 2).toFixed(1)} ${(y + 0.6).toFixed(1)}Q${x.toFixed(1)} ${(y - 1.4).toFixed(1)} ${(x + l / 2).toFixed(1)} ${(y - 0.2).toFixed(1)}`}
            w={w}
            c={light ? "gloss" : "deep"}
            o={light ? 0.14 : 0.3}
            taper={[0.3, 0.4]}
          />
        ))}

        {/* the block wall along the lane */}
        <Fill d={rect(40, 316, 560, 20)} c="sheet" />
        <Fill d={rect(40, 316, 560, 20)} c="blue-light" o={0.2} />
        <Fill d={rect(40, 316, 560, 20)} c="deep" o={0.36} />
        <Brush d="M70 316.5H570" w={2.6} c="deep" o={0.5} taper={[0.02, 0.02]} />
        <Brush d="M70 318.5H570" w={1} c="gloss" o={0.25} taper={[0.02, 0.02]} />
        <Brush d="M70 324H570M70 330H570" w={0.5} c="deep" o={0.14} taper={[0.02, 0.02]} />
        <Brush
          d={Array.from({ length: 50 }, (_, k) => {
            const x = 72 + k * 10;
            return `M${x} 319V324M${x + 5} 324V330M${x} 330V336`;
          }).join("")}
          w={0.5}
          c="deep"
          o={0.1}
        />
        <Brush d="M200 322Q204 328 201 336M392 320Q394 330 392 336" w={1.6} c="deep" o={0.16} />
      </g>

      {/* the lane, wet: it holds the light of the sky */}
      <g filter="url(#w-paint)">
        <Fill d={rect(40, 336, 560, 60)} c="sheet" />
        <Fill d={rect(40, 336, 560, 60)} c="blue-light" o={0.22} />
        <Fill d={rect(40, 336, 560, 60)} c="deep" o={0.6} />
        <Fill d={rect(40, 336, 560, 8)} c="deep" o={0.12} />
        <Brush d="M70 338H570" w={3} c="deep" o={0.3} taper={[0.02, 0.02]} />
        <Brush d="M80 349Q300 345 560 351" w={6} c="gloss" o={0.12} taper={[0.2, 0.3]} />
        <Brush d="M140 361Q320 357 520 363" w={4} c="gloss" o={0.1} taper={[0.3, 0.3]} />
        <Brush d="M300 372Q420 369 560 373" w={5} c="gloss" o={0.08} taper={[0.3, 0.3]} />
      </g>
      {/* long reflections standing in the water */}
      <g filter="url(#w-haze)">
        {[
          [105, 0.55, 3, "cream"],
          [441, 0.35, 2, "cream"],
          [512, 0.25, 2.4, "cream"],
          [168, 0.22, 5, "gloss"],
          [262, 0.2, 6, "gloss"],
          [372, 0.2, 5, "gloss"],
          [544, 0.18, 5, "gloss"],
        ].map(([x, o, w, c]) => (
          <g key={x as number}>
            <Brush
              d={`M${x} 339V352`}
              w={w as number}
              c={c as Paint}
              o={o as number}
              taper={[0.1, 0.4]}
            />
            <Brush
              d={`M${(x as number) + 0.5} 354V368`}
              w={(w as number) * 0.7}
              c={c as Paint}
              o={(o as number) * 0.6}
              taper={[0.3, 0.6]}
            />
          </g>
        ))}
        {/* the lamp, upside down in the lane */}
        <Brush d={`M${lamp.x} 338V362`} w={12} c="cream" o={0.3} taper={[0.05, 0.5]} />
        <Brush d={`M${lamp.x} 338V354`} w={3.4} c="cream" o={1} taper={[0.05, 0.5]} />
        <Brush d={`M${lamp.x + 0.6} 356V365`} w={2.4} c="cream" o={0.75} taper={[0.3, 0.5]} />
        <Brush d={`M${lamp.x - 0.4} 368V378`} w={1.6} c="cream" o={0.5} taper={[0.3, 0.5]} />
        {/* the umbrella, and its reflection */}
        <Fill d="M244 357Q250 352 256 357Q250 356 244 357Z" c="green" o={0.35} />
      </g>
      <g filter="url(#w-bloom)">
        <Fill d={ellipse(lamp.x, 342, 30, 7)} c="cream" o={0.22} />
      </g>

      {/* someone walking home under a pale green umbrella */}
      <g filter="url(#w-paint)">
        <Fill d="M241 343Q242 334 250 333Q258 334 259 343Q250 341 241 343Z" c="green" o={0.92} />
        <Brush d="M243 341Q250 336 257 341" w={1.2} c="gloss" o={0.4} taper={[0.2, 0.2]} />
        <Brush d="M250 333V346" w={0.6} c="deep" o={0.7} />
        <Fill d="M246.5 343H253.5L253 351H247Z" c="deep" o={0.7} />
        <Brush d="M248.5 350V356M251.6 350V355.5" w={1.2} c="deep" o={0.7} taper={[0.05, 0.3]} />
      </g>

      {/* the neighbour's roof, just under the window */}
      <g filter="url(#w-paint)">
        <Fill d="M40 350L130 338L214 390H40Z" c="sheet" />
        <Fill d="M40 350L130 338L214 390H40Z" c="deep" o={0.74} />
        {Array.from({ length: 13 }, (_, k) => {
          const t = k / 12;
          const top = lerp([66, 346], [130, 338], t);
          const bottom = lerp([60, 390], [214, 390], t);
          return (
            <Brush
              key={k}
              pts={[top, bottom]}
              w={1}
              c="gloss"
              o={0.16}
              taper={[0.1, 0.2]}
              pressure={0.1}
            />
          );
        })}
        <Brush d="M60 362L150 352M66 374L170 364" w={0.8} c="deep" o={0.4} />
        <Brush d="M44 349L131 337L216 390" w={3} c="deep" o={0.55} taper={[0.02, 0.05]} />
        <Brush d="M70 346L128 339L178 368" w={2} c="gloss" o={0.22} taper={[0.2, 0.4]} />
      </g>

      {/* the street lamp, its light spread by the rain */}
      <g filter="url(#w-bloom)">
        <Fill d={circle(lamp.x, lamp.y + 2, 58)} c="cream" o={0.16} />
        <Fill d={circle(lamp.x, lamp.y + 3, 36)} c="cream" o={0.24} />
        <Fill d={circle(lamp.x, lamp.y + 3, 20)} c="cream" o={0.4} />
        <Fill d={circle(lamp.x, lamp.y + 3, 9)} c="gloss" o={0.6} />
        <Fill
          d={`M${lamp.x - 6} ${lamp.y + 4}L${lamp.x - 34} 336H${lamp.x + 34}L${lamp.x + 6} ${lamp.y + 4}Z`}
          c="cream"
          o={0.08}
        />
      </g>

      {/* the pole, nearest of all, sharp and dark */}
      <g filter="url(#w-paint)">
        <Brush
          d="M431 30Q429.5 200 432 392"
          w={6.6}
          c="deep"
          o={0.82}
          taper={[0, 0]}
          pressure={0.06}
        />
        <Brush d="M429.6 36Q428.4 200 430.6 388" w={1.4} c="gloss" o={0.22} taper={[0.05, 0.05]} />
        {/* the steps up the pole */}
        <Brush
          d={Array.from({ length: 11 }, (_, k) => {
            const y = 176 + k * 16;
            return k % 2 ? `M434 ${y}H436.6` : `M428 ${y + 0.4}H425.4`;
          }).join("")}
          w={0.9}
          c="deep"
          o={0.7}
          taper={[0, 0]}
          pressure={0}
        />
        {/* crossarms and insulators */}
        <Brush d="M404 92Q430 91 456 92" w={3.4} c="deep" o={0.8} taper={[0.02, 0.02]} />
        <Brush d="M410 108Q430 107 450 108" w={3} c="deep" o={0.75} taper={[0.02, 0.02]} />
        {[408, 420, 442, 452].map((x) => (
          <g key={x}>
            <Fill d={rr(x - 1.8, 84, 3.6, 7, 1.4)} c="gloss" o={0.6} />
            <Fill d={rr(x - 1.8, 84, 3.6, 7, 1.4)} c="deep" o={0.3} />
          </g>
        ))}
        {/* the transformer */}
        <Fill d={rr(435, 124, 15, 26, 3)} c="deep" o={0.75} />
        <Brush d="M438 127V147" w={1.6} c="gloss" o={0.3} taper={[0.1, 0.1]} />
        <Brush d="M434 130H436M434 144H436" w={1.6} c="deep" o={0.8} />
        <Brush d="M442 124Q442 116 446 108" w={0.8} c="deep" o={0.7} />
        {/* a sign on the pole */}
        <Fill d={rect(427.4, 196, 7.4, 22)} c="gloss" o={0.42} />
        <Brush d="M431 199V215" w={1.2} c="deep" o={0.4} pressure={0.1} />
        {/* the lamp arm and its hood */}
        <Brush
          d={`M432 ${lamp.y + 8}Q446 ${lamp.y - 6} ${lamp.x + 2} ${lamp.y - 2}`}
          w={2}
          c="deep"
          o={0.8}
          taper={[0.02, 0.1]}
        />
        <Fill
          d={`M${lamp.x - 9} ${lamp.y + 2}Q${lamp.x} ${lamp.y - 4} ${lamp.x + 9} ${lamp.y + 2}L${lamp.x + 7} ${lamp.y + 4}H${lamp.x - 7}Z`}
          c="deep"
          o={0.85}
        />
        <Fill
          d={`M${lamp.x - 6} ${lamp.y + 4}H${lamp.x + 6}Q${lamp.x} ${lamp.y + 8} ${lamp.x - 6} ${lamp.y + 4}Z`}
          c="cream"
        />
        <Fill d={ellipse(lamp.x, lamp.y + 5, 3.4, 1.4)} c="gloss" />

        {/* the wires, sagging under their own weight */}
        <Brush d="M404 90Q240 170 60 122" w={1.2} c="deep" o={0.7} taper={[0, 0]} pressure={0.1} />
        <Brush d="M420 90Q250 188 60 142" w={1.1} c="deep" o={0.65} taper={[0, 0]} pressure={0.1} />
        <Brush d="M412 106Q262 196 60 164" w={1} c="deep" o={0.6} taper={[0, 0]} pressure={0.1} />
        <Brush d="M442 90Q512 126 590 112" w={1.2} c="deep" o={0.7} taper={[0, 0]} pressure={0.1} />
        <Brush
          d="M452 90Q520 140 590 134"
          w={1.1}
          c="deep"
          o={0.65}
          taper={[0, 0]}
          pressure={0.1}
        />
        <Brush d="M450 108Q524 156 590 160" w={1} c="deep" o={0.55} taper={[0, 0]} pressure={0.1} />
        <Brush
          d="M432 152Q330 236 268 290"
          w={0.9}
          c="deep"
          o={0.5}
          taper={[0, 0.1]}
          pressure={0.1}
        />
        <Brush
          d="M432 160Q470 220 520 252"
          w={0.8}
          c="deep"
          o={0.45}
          taper={[0, 0.1]}
          pressure={0.1}
        />
        {/* beads of water along the lowest wire */}
        {[110, 160, 205, 252, 300, 344, 480, 530].map((x, i) => {
          const y =
            i < 6 ? 142 + Math.sin(((x - 60) / 350) * Math.PI) * 40 : 132 + (x - 452) * 0.12;
          return <Fill key={x} d={circle(x, y + 1.6, 0.9)} c="gloss" o={0.6} />;
        })}
      </g>
    </svg>
  );
}

/* the glass and the room */

/** drops resting on the glass, more of them low on the pane, few of them large */
const restingDrops = panes.flatMap((p, i) => {
  const rand = seeded(i * 3 + 11);
  const n = p.h > 150 ? 34 : 14;
  return Array.from({ length: n }, () => {
    const x = p.x + 4 + rand() * (p.w - 8);
    const y = p.y + 5 + Math.sqrt(rand()) * (p.h - 10);
    const r = 0.6 + rand() * rand() * rand() * 3.4;
    return { x, y, r };
  }).filter(({ x, y }) => Math.abs(x - doll.x) > 20 || y < doll.y - 16 || y > doll.y + 46);
});

/** the leaves of the garden tree, dab by dab, lit from above on the left */
const treeDabs = (() => {
  const rand = seeded(37);
  return Array.from({ length: 46 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand());
    const light = i >= 34;
    return {
      x: 220 + Math.cos(a) * 17 * d - (light ? 4 : 0),
      y: 298 + Math.sin(a) * 12 * d - (light ? 4 : 0),
      l: 5 + rand() * 6,
      w: 2.6 + rand() * 2.6,
      light,
    };
  });
})();

/** the fine mist of droplets in the fogged corners */
const mistDots = (() => {
  const rand = seeded(29);
  const corners: [number, number, number, number][] = [
    [85, 366, 70, 40],
    [312, 366, 34, 20],
    [328, 366, 34, 20],
    [556, 366, 76, 44],
  ];
  return corners.flatMap(([cx, cy, rx, ry]) =>
    Array.from({ length: 40 }, () => {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      return {
        x: cx + Math.cos(a) * rx * d,
        y: cy - Math.abs(Math.sin(a)) * ry * d,
        r: 0.25 + rand() * 0.45,
      };
    }).filter(({ x }) => (x > 86 && x < 311) || (x > 329 && x < 555)),
  );
})();

function VBar({
  x,
  y,
  w,
  h,
  dark = 0.45,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  dark?: number;
}) {
  const cx = x + w / 2;
  return (
    <>
      <Brush
        d={`M${cx} ${y + 1}V${y + h - 1}`}
        w={w}
        c="indigo-wash"
        taper={[0.02, 0.02]}
        pressure={0.12}
      />
      <Brush
        d={`M${x + w * 0.3} ${y + 4}V${y + h - 4}`}
        w={w * 0.34}
        c="gloss"
        o={0.34}
        taper={[0.03, 0.05]}
        pressure={0.2}
      />
      <Brush
        d={`M${x + w * 0.82} ${y + 3}V${y + h - 3}`}
        w={w * 0.3}
        c="deep"
        o={dark}
        taper={[0.03, 0.03]}
        pressure={0.15}
      />
    </>
  );
}

function HBar({
  x,
  y,
  w,
  h,
  dark = 0.45,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  dark?: number;
}) {
  const cy = y + h / 2;
  return (
    <>
      <Brush
        d={`M${x + 1} ${cy}H${x + w - 1}`}
        w={h}
        c="indigo-wash"
        taper={[0.02, 0.02]}
        pressure={0.12}
      />
      <Brush
        d={`M${x + 4} ${y + h * 0.3}H${x + w - 4}`}
        w={h * 0.32}
        c="gloss"
        o={0.34}
        taper={[0.03, 0.05]}
        pressure={0.2}
      />
      <Brush
        d={`M${x + 3} ${y + h * 0.82}H${x + w - 3}`}
        w={h * 0.3}
        c="deep"
        o={dark}
        taper={[0.03, 0.03]}
        pressure={0.15}
      />
    </>
  );
}

function FrontContent() {
  return (
    <>
      {/* flat shadows on the wall, right of the casing and under the sill */}
      <g filter="url(#w-flat)">
        <Fill d="M584 46H596Q608 46 608 58V398H584Z" c="shadow" />
        <Fill d="M34 428H630Q640 428 640 440V462Q640 474 628 474H58Q46 474 44 462Z" c="shadow" />
      </g>

      {/* on the glass, clipped to it by a nested viewport, since ids would repeat */}
      <svg
        x={glass.x}
        y={glass.y}
        width={glass.w}
        height={glass.h}
        viewBox={`${glass.x} ${glass.y} ${glass.w} ${glass.h}`}
        overflow="hidden"
      >
        {/* the glass: a cool tint, the room faintly warm in it */}
        <g filter="url(#w-bloom)">
          <Fill d={rect(glass.x, glass.y, glass.w, glass.h)} c="blue-light" o={0.06} />
          <Fill d={rect(glass.x, 300, glass.w, 80)} c="cream" o={0.06} />
        </g>

        {/* condensation, thickest in the lower corners */}
        <g filter="url(#w-bloom)">
          <Fill d={ellipse(85, 374, 78, 48)} c="gloss" o={0.07} />
          <Fill d={ellipse(85, 372, 44, 28)} c="gloss" o={0.1} />
          <Fill d={ellipse(85, 370, 20, 14)} c="gloss" o={0.12} />
          <Fill d={ellipse(556, 374, 84, 50)} c="gloss" o={0.07} />
          <Fill d={ellipse(556, 372, 46, 30)} c="gloss" o={0.1} />
          <Fill d={ellipse(556, 370, 22, 14)} c="gloss" o={0.12} />
          <Fill d={ellipse(312, 370, 50, 24)} c="gloss" o={0.09} />
          <Fill d={ellipse(328, 370, 50, 24)} c="gloss" o={0.09} />
          <Fill d={rect(85, 354, 471, 14)} c="gloss" o={0.07} />
          <Fill d={rect(85, 148, 471, 10)} c="gloss" o={0.06} />
          <Fill d={ellipse(85, 158, 30, 14)} c="gloss" o={0.1} />
          <Fill d={ellipse(556, 158, 34, 16)} c="gloss" o={0.1} />
        </g>
        <g>
          {mistDots.map(({ x, y, r }, i) => (
            <circle key={i} cx={x} cy={y} r={r} className="fill-w-gloss" opacity={0.45} />
          ))}
        </g>

        {/* the glare of the grey sky on the glass */}
        <g filter="url(#w-haze-far)">
          <Brush d="M98 364L206 160" w={30} c="gloss" o={0.08} taper={[0.3, 0.3]} />
          <Brush d="M336 154L384 56" w={22} c="gloss" o={0.08} taper={[0.3, 0.3]} />
          <Brush d="M478 364L552 206" w={22} c="gloss" o={0.06} taper={[0.3, 0.3]} />
        </g>
        <g filter="url(#w-paint)">
          <Brush d="M120 364L208 190" w={1} c="gloss" o={0.18} taper={[0.3, 0.3]} />
          <Brush d="M354 152L390 70" w={0.9} c="gloss" o={0.2} taper={[0.3, 0.3]} />
        </g>

        {/* drops resting on the glass: a darker rim above, the light gathered below, a bright point */}
        <g>
          {restingDrops.map(({ x, y, r }, i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} className="fill-w-deep" opacity={0.14} />
              <circle
                cx={x}
                cy={y + r * 0.28}
                r={r * 0.72}
                className="fill-w-gloss"
                opacity={0.4}
              />
              {r > 1.2 && (
                <Brush
                  pts={ptsOfCircle(x, y, r * 0.86, Math.PI * 1.05, Math.PI * 1.95)}
                  w={r * 0.32}
                  c="deep"
                  o={0.32}
                  taper={[0.3, 0.3]}
                  pressure={0}
                />
              )}
              <circle
                cx={x - r * 0.34}
                cy={y - r * 0.32}
                r={Math.max(0.32, r * 0.26)}
                className="fill-w-gloss"
                opacity={0.95}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* the casing and the two sashes, painted cobalt */}
      <g filter="url(#w-wash)">
        <Fill d={rr(52, 20, 536, 24, 4)} c="indigo-wash" o={0.9} />
        <Fill d={rr(52, 20, 24, 374, 4)} c="indigo-wash" o={0.9} />
        <Fill d={rr(564, 20, 24, 374, 4)} c="indigo-wash" o={0.9} />
        <Fill d={rr(52, 376, 536, 18, 3)} c="indigo-wash" o={0.9} />
        <Fill d={rr(74, 42, 11, 338, 2)} c="indigo-wash" o={0.85} />
        <Fill d={rr(74, 42, 248, 10, 2)} c="indigo-wash" o={0.85} />
        <Fill d={rr(74, 366, 248, 14, 2)} c="indigo-wash" o={0.85} />
        <Fill d={rr(84, 156, 230, 6, 1)} c="indigo-wash" o={0.85} />
        <Fill d={rr(312, 42, 16, 338, 2)} c="indigo-wash" o={0.85} />
        <Fill d={rr(318, 42, 248, 10, 2)} c="indigo-wash" o={0.85} />
        <Fill d={rr(318, 366, 248, 14, 2)} c="indigo-wash" o={0.85} />
        <Fill d={rr(326, 156, 232, 6, 1)} c="indigo-wash" o={0.85} />
        <Fill d={rr(556, 42, 10, 338, 2)} c="indigo-wash" o={0.85} />
      </g>
      <g filter="url(#w-paint)">
        {/* casing */}
        <HBar x={52} y={20} w={536} h={22} dark={0.6} />
        <VBar x={52} y={22} w={22} h={370} />
        <VBar x={566} y={22} w={22} h={370} dark={0.6} />
        <HBar x={56} y={378} w={528} h={14} dark={0.55} />
        {/* the inner edge of the casing, in shade */}
        <Brush d="M74 44H566" w={3.4} c="deep" o={0.5} taper={[0.02, 0.02]} />
        <Brush d="M76 44V378" w={3} c="deep" o={0.4} taper={[0.02, 0.02]} />
        <Brush d="M564 44V378" w={3} c="gloss" o={0.3} taper={[0.02, 0.02]} />
        <Brush d="M58 26H582" w={2.4} c="gloss" o={0.4} taper={[0.05, 0.08]} pressure={0.25} />
        <Brush d="M57 28V388" w={2.2} c="gloss" o={0.36} taper={[0.05, 0.08]} pressure={0.25} />
        <Brush d="M140 31H300" w={7} c="blue-light" o={0.22} taper={[0.4, 0.4]} />
        <Brush d="M380 32H520" w={6} c="label" o={0.3} taper={[0.4, 0.4]} />
        <Brush d="M62 120V250" w={7} c="blue-light" o={0.2} taper={[0.4, 0.4]} />
        <Brush d="M578 160V320" w={7} c="label" o={0.35} taper={[0.4, 0.4]} />

        {/* the left sash */}
        <VBar x={74} y={42} w={11} h={338} />
        <HBar x={74} y={42} w={248} h={10} />
        <HBar x={84} y={156} w={228} h={6} />
        <HBar x={74} y={366} w={248} h={14} dark={0.55} />
        <VBar x={312} y={42} w={10} h={338} dark={0.6} />
        {/* the right sash, on the outer track, overlapping it */}
        <VBar x={318} y={42} w={10} h={338} />
        <HBar x={318} y={42} w={248} h={10} />
        <HBar x={326} y={156} w={232} h={6} />
        <HBar x={318} y={366} w={248} h={14} dark={0.55} />
        <VBar x={556} y={42} w={10} h={338} dark={0.55} />
        <Brush d="M316 46V376" w={2.6} c="deep" o={0.65} taper={[0.03, 0.03]} />
        {/* the finger pulls */}
        <Fill d={rr(314, 228, 6, 34, 3)} c="deep" o={0.6} />
        <Fill d={rr(320, 230, 6, 30, 3)} c="deep" o={0.55} />
        <Brush d="M323 234V256" w={1.2} c="gloss" o={0.5} taper={[0.2, 0.2]} />
        {/* the latch between the sashes */}
        <Fill d={rr(311, 196, 18, 9, 2)} c="ink-soft" o={0.9} />
        <Brush d="M313 198H327" w={1.4} c="gloss" o={0.6} taper={[0.2, 0.2]} />
        <Brush d="M90 47H220" w={5} c="blue-light" o={0.2} taper={[0.4, 0.4]} />
        <Brush d="M400 47H520" w={5} c="label" o={0.3} taper={[0.4, 0.4]} />
        <Brush d="M79 180V300" w={6} c="blue-light" o={0.2} taper={[0.4, 0.4]} />
        <Brush d="M561 90V200" w={6} c="label" o={0.35} taper={[0.4, 0.4]} />
        <Brush d="M130 373H260" w={7} c="label" o={0.3} taper={[0.4, 0.4]} />
        <Brush d="M380 372H500" w={7} c="blue-light" o={0.18} taper={[0.4, 0.4]} />
      </g>

      {/* a teru teru bozu, hung for fine weather; it is still raining */}
      <g filter="url(#w-wash)">
        <Fill d={circle(doll.x + 4, doll.y + 3, 12)} c="ink" o={0.12} />
        <Fill
          d={`M${doll.x - 9} ${doll.y + 6}Q${doll.x - 18} ${doll.y + 28} ${doll.x - 15} ${doll.y + 40}Q${doll.x - 4} ${doll.y + 36} ${doll.x + 2} ${doll.y + 42}Q${doll.x + 10} ${doll.y + 36} ${doll.x + 17} ${doll.y + 40}Q${doll.x + 16} ${doll.y + 26} ${doll.x + 9} ${doll.y + 6}Z`}
          c="gloss"
          o={0.92}
        />
        <Fill d={circle(doll.x, doll.y, 11)} c="gloss" o={0.92} />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          d={`M${doll.x} 42V${doll.y - 10}`}
          w={1}
          c="ink-soft"
          o={0.85}
          taper={[0, 0.1]}
          pressure={0.1}
        />
        <Brush
          pts={ptsOfCircle(doll.x, doll.y, 11, -0.6, 2.4)}
          w={2.4}
          c="ink-soft"
          o={0.45}
          taper={[0.3, 0.3]}
        />
        <Brush
          pts={ptsOfCircle(doll.x, doll.y, 11, 2.2, 5)}
          w={1.2}
          c="ink-soft"
          o={0.6}
          taper={[0.3, 0.3]}
        />
        <Brush pts={ptsOfCircle(doll.x - 3, doll.y - 3, 4, 3.4, 5.2)} w={2} c="gloss" o={0.9} />
        <Brush
          d={`M${doll.x - 10} ${doll.y + 9}Q${doll.x} ${doll.y + 13} ${doll.x + 10} ${doll.y + 9}`}
          w={1.6}
          c="indigo-wash"
          o={0.8}
          taper={[0.2, 0.2]}
        />
        <Brush
          d={`M${doll.x + 8} ${doll.y + 14}Q${doll.x + 14} ${doll.y + 26} ${doll.x + 15} ${doll.y + 38}`}
          w={2.6}
          c="ink-soft"
          o={0.35}
          taper={[0.3, 0.3]}
        />
        <Brush
          d={`M${doll.x - 9} ${doll.y + 14}Q${doll.x - 14} ${doll.y + 26} ${doll.x - 14} ${doll.y + 38}`}
          w={1}
          c="ink-soft"
          o={0.5}
          taper={[0.3, 0.3]}
        />
        <Brush
          d={`M${doll.x + 1} ${doll.y + 18}Q${doll.x + 3} ${doll.y + 30} ${doll.x + 2} ${doll.y + 40}`}
          w={0.9}
          c="ink-soft"
          o={0.4}
          taper={[0.3, 0.3]}
        />
      </g>

      {/* the deep sill, painted like the frame, the grain showing through */}
      <g filter="url(#w-wash)">
        <Fill d="M44 390H596L618 414H22Z" c="indigo-wash" />
        <Fill d={rr(20, 412, 600, 22, 3)} c="indigo-wash" />
        <Fill d={rr(20, 412, 600, 22, 3)} c="label" o={0.45} />
      </g>
      <g filter="url(#w-paint)">
        <Brush d="M46 393H594" w={6} c="deep" o={0.5} taper={[0.02, 0.02]} />
        <Brush
          d="M40 400Q320 398 602 401"
          w={8}
          c="gloss"
          o={0.24}
          taper={[0.05, 0.1]}
          pressure={0.25}
        />
        <Brush d="M32 407Q320 405 610 408" w={7} c="blue-light" o={0.2} taper={[0.1, 0.1]} />
        <Brush
          d="M70 398Q160 400 250 397Q330 395 400 399"
          w={1}
          c="gloss"
          o={0.4}
          taper={[0.2, 0.3]}
        />
        <Brush
          d="M130 405Q250 402 330 406Q420 409 560 404"
          w={0.9}
          c="gloss"
          o={0.32}
          taper={[0.2, 0.3]}
        />
        <Brush d="M380 395Q460 398 580 396" w={0.9} c="label" o={0.5} taper={[0.2, 0.3]} />
        <Brush d="M24 413H616" w={2.6} c="gloss" o={0.55} taper={[0.03, 0.05]} pressure={0.2} />
        <Brush
          d="M26 420Q200 418 400 421Q520 423 614 420"
          w={5}
          c="indigo-wash"
          o={0.5}
          taper={[0.05, 0.05]}
        />
        <Brush d="M40 424Q140 426 240 423" w={1} c="blue-light" o={0.4} taper={[0.2, 0.3]} />
        <Brush d="M300 426Q420 423 590 427" w={1} c="blue-light" o={0.32} taper={[0.2, 0.3]} />
        <Brush d="M24 432H616" w={3} c="deep" o={0.7} taper={[0.02, 0.02]} />
        <Brush d="M612 414V432" w={4} c="deep" o={0.5} taper={[0.1, 0.1]} />
      </g>

      {/* a cup of tea gone cold, on the right of the sill */}
      <g filter="url(#w-flat)">
        <Fill
          d={`M${cup.x - 6} ${cup.bottom - 3}Q${cup.x + 30} ${cup.bottom - 9} ${cup.x + 52} ${cup.bottom - 3}Q${cup.x + 30} ${cup.bottom + 4} ${cup.x - 6} ${cup.bottom + 3}Z`}
          c="deep"
          o={0.45}
        />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill
          d={`M${cup.x - 15} ${cup.top}Q${cup.x - 16} ${cup.top + 30} ${cup.x - 13} ${cup.bottom - 3}Q${cup.x} ${cup.bottom + 2} ${cup.x + 13} ${cup.bottom - 3}Q${cup.x + 16} ${cup.top + 30} ${cup.x + 15} ${cup.top}Z`}
          c="gloss"
          o={0.95}
        />
        <Fill
          d={`M${cup.x - 15} ${cup.top}L${cup.x - 15.6} ${cup.top + 20}Q${cup.x - 12} ${cup.top + 25} ${cup.x - 9} ${cup.top + 21}Q${cup.x - 7} ${cup.top + 31} ${cup.x - 4} ${cup.top + 22}Q${cup.x + 1} ${cup.top + 26} ${cup.x + 5} ${cup.top + 21}Q${cup.x + 8} ${cup.top + 28} ${cup.x + 10} ${cup.top + 22}Q${cup.x + 13} ${cup.top + 24} ${cup.x + 15.6} ${cup.top + 20}L${cup.x + 15} ${cup.top}Z`}
          c="indigo-wash"
          o={0.92}
        />
      </g>
      <g filter="url(#w-paint)">
        <Brush
          d={`M${cup.x + 10} ${cup.top + 6}Q${cup.x + 12} ${cup.top + 30} ${cup.x + 9} ${cup.bottom - 6}`}
          w={6}
          c="ink-soft"
          o={0.3}
          taper={[0.1, 0.1]}
        />
        <Brush
          d={`M${cup.x + 12.5} ${cup.top + 3}V${cup.top + 19}`}
          w={3.4}
          c="deep"
          o={0.5}
          taper={[0.1, 0.2]}
        />
        <Brush
          d={`M${cup.x - 9.5} ${cup.top + 4}V${cup.top + 18}`}
          w={2.2}
          c="gloss"
          o={0.7}
          taper={[0.2, 0.3]}
        />
        <Brush
          d={`M${cup.x - 10} ${cup.top + 30}Q${cup.x - 11} ${cup.top + 38} ${cup.x - 9} ${cup.bottom - 7}`}
          w={2}
          c="gloss"
          o={0.9}
          taper={[0.2, 0.3]}
        />
        <Brush
          d={`M${cup.x - 13} ${cup.bottom - 4}Q${cup.x} ${cup.bottom + 1.5} ${cup.x + 13} ${cup.bottom - 4}`}
          w={2.6}
          c="ink-soft"
          o={0.6}
          taper={[0.1, 0.1]}
        />
        <Brush
          d={`M${cup.x - 12} ${cup.bottom - 8}Q${cup.x} ${cup.bottom - 3} ${cup.x + 12} ${cup.bottom - 8}`}
          w={0.9}
          c="ink-soft"
          o={0.45}
          taper={[0.2, 0.2]}
        />
        {/* the rim and the cold tea inside, low in the cup */}
        <Fill
          d={`M${cup.x - 15} ${cup.top}Q${cup.x} ${cup.top - 7} ${cup.x + 15} ${cup.top}Q${cup.x} ${cup.top + 7} ${cup.x - 15} ${cup.top}Z`}
          c="label"
        />
        <Fill
          d={`M${cup.x - 11} ${cup.top + 1.4}Q${cup.x} ${cup.top - 2} ${cup.x + 11} ${cup.top + 1.4}Q${cup.x} ${cup.top + 5.4} ${cup.x - 11} ${cup.top + 1.4}Z`}
          c="green-deep"
          o={0.8}
        />
        <Brush
          d={`M${cup.x - 7} ${cup.top + 2.4}Q${cup.x} ${cup.top + 4.6} ${cup.x + 8} ${cup.top + 2.4}`}
          w={1.8}
          c="green"
          o={0.7}
          taper={[0.2, 0.2]}
        />
        <Brush
          d={`M${cup.x - 15} ${cup.top}Q${cup.x} ${cup.top - 7} ${cup.x + 15} ${cup.top}`}
          w={1.6}
          c="gloss"
          o={0.55}
          taper={[0.1, 0.1]}
        />
        <Brush
          d={`M${cup.x - 15} ${cup.top}Q${cup.x} ${cup.top + 7} ${cup.x + 15} ${cup.top}`}
          w={1.8}
          c="gloss"
          o={0.7}
          taper={[0.1, 0.1]}
        />
      </g>
    </>
  );
}

const viewBox = `0 0 ${VIEWBOX.w} ${VIEWBOX.h}`;

/** the town behind the glass, under the rain; it fills only the glass */
export function WindowOutside({ className }: { className?: string }) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden>
      <OutsideContent />
    </svg>
  );
}

/** the glass, the frame and the room; the glass is clear, so the town and the rain show through */
export function WindowFront({ className }: { className?: string }) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label="Rain on a window, seen from a quiet room"
    >
      <FrontContent />
    </svg>
  );
}
