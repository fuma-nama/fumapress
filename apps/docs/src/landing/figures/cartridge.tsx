import { Brush, Fill, box, gear, ptsOfCircle, rr, cast, Stroke, ring, type Paint } from "../pen";

/* figure: a plugin, pictured as a cartridge you slot into the press */

const shell = { x: 22, y: 12, w: 458, h: 148, r: 18 };
const win = { x: 62, y: 30, w: 220, h: 104 };
const label = { x: 294, y: 30, w: 158, h: 104 };
const reelY = 82;
/** the left reel holds most of the tape */
const reels = [
  { cx: 118, pack: 29 },
  { cx: 226, pack: 19 },
];
const screws: [number, number][] = [
  [40, 25],
  [462, 25],
  [40, 147],
  [462, 147],
];

const f = (n: number) => n.toFixed(1);

function polar(cx: number, cy: number, r: number, a: number) {
  return `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
}

/** an arc of a circle, painted from angle `a0` to `a1` */
function Arc({
  cx,
  cy,
  r,
  a0,
  a1,
  w,
  c,
  o,
}: {
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
  w: number;
  c: Paint;
  o?: number;
}) {
  return <Brush pts={ptsOfCircle(cx, cy, r, a0, a1)} w={w} c={c} o={o} taper={[0.2, 0.45]} />;
}

/** rough width of a string in em, for a serif face */
function em(s: string) {
  let w = 0;
  for (const ch of s) {
    if (ch === " ") w += 0.26;
    else if ("ijltfrI.,'|:;!".includes(ch)) w += 0.31;
    else if ("mwMW".includes(ch)) w += 0.84;
    else if (ch >= "A" && ch <= "Z") w += 0.69;
    else w += 0.53;
  }
  return w;
}

/** the shadow of a screw head and its recess */
function ScrewWash({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <>
      <Fill d={ring(x, y, r)} c="deep" o={0.32} />
      <Fill d={ring(x + 1, y + 1, r * 0.75)} c="deep" o={0.25} />
    </>
  );
}

/** a screw head: a dark core, a lit rim, its slot */
function ScrewStrokes({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <>
      <Brush pts={ptsOfCircle(x, y, r * 0.45)} w={r * 0.9} c="deep" o={0.7} />
      <Brush pts={ptsOfCircle(x, y, r)} w={1.6} loop={2} seed={x * 0.1 + y} />
      <Arc
        cx={x}
        cy={y}
        r={r * 0.72}
        a0={Math.PI * 1.02}
        a1={Math.PI * 1.55}
        w={1.8}
        c="gloss"
        o={0.92}
      />
      <Arc cx={x} cy={y} r={r * 0.78} a0={0.05} a1={1.5} w={1.6} c="blue-light" o={0.55} />
      <Arc cx={x} cy={y} r={r + 2} a0={0.2} a1={1.9} w={1.8} c="label" o={0.6} />
      <Stroke
        d={`M${x - r * 0.62} ${y + r * 0.42}L${x + r * 0.62} ${y - r * 0.42}`}
        w={1.1}
        taper={[0.15, 0.15]}
      />
      <Stroke
        d={`M${x - r * 0.5} ${y + r * 0.62}L${x + r * 0.66} ${y - r * 0.16}`}
        w={0.6}
        c="gloss"
        o={0.6}
      />
    </>
  );
}

/** an unpainted circle, so the bounding box of a turning group is centered on its hub */
function Pivot({ cx, cy }: { cx: number; cy: number }) {
  return <path d={ring(cx, cy, 34)} fill="none" stroke="none" />;
}

function Reel({ cx, pack }: { cx: number; pack: number }) {
  const cy = reelY;
  const flange = 31;
  /** while the tape plays, the fuller reel turns slower */
  const turn = pack > 24 ? "w-turn-slow" : "w-turn";
  return (
    <>
      {/* the wound tape turns; its shading and glints stay with the light */}
      <g className="w-spin">
        <g className={turn}>
          <Pivot cx={cx} cy={cy} />
          <g filter="url(#w-wash)">
            <Fill d={ring(cx, cy, flange)} c="indigo-wash" o={0.18} />
            <Fill d={ring(cx, cy, pack)} c="indigo-wash" o={0.6} />
          </g>
        </g>
      </g>
      <g filter="url(#w-wash)">
        <Fill
          d={`M${polar(cx, cy, pack, -0.4)}A${pack} ${pack} 0 0 1 ${polar(cx, cy, pack, 2.3)}A${pack * 0.8} ${pack * 0.8} 0 0 0 ${polar(cx, cy, pack, -0.4)}Z`}
          c="deep"
          o={0.5}
        />
      </g>
      <g className="w-spin">
        <g className={turn}>
          <Pivot cx={cx} cy={cy} />
          <g filter="url(#w-wash)">
            <Fill d={ring(cx, cy, 11.5)} c="deep" o={0.7} />
            <Fill d={ring(cx, cy, 9.5)} c="green" o={0.82} />
          </g>
          <g filter="url(#w-wash-dense)">
            <Fill d={gear(cx, cy, 3.6, 6, 2)} c="deep" />
          </g>
          <g filter="url(#w-paint)">
            {/* the clear flange and its spokes */}
            <Stroke bold d={ring(cx, cy, flange)} w={1.1} c="gloss" o={0.8} />
            <Stroke d={ring(cx, cy, flange - 2.5)} w={0.5} c="gloss" o={0.35} />
            {Array.from({ length: Math.max(1, Math.floor((pack - 13) / 4)) }, (_, i) => (
              <Stroke key={i} d={ring(cx, cy, pack - 2 - i * 4)} w={0.5} c="gloss" o={0.22} />
            ))}
            <Stroke d={ring(cx, cy, pack)} w={0.9} c="ink" o={0.6} />
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = (k * Math.PI) / 3 + 0.35;
              return (
                <g key={k}>
                  <Stroke
                    d={`M${polar(cx, cy, 12.5, a)}L${polar(cx, cy, flange - 3, a)}`}
                    w={1}
                    c="gloss"
                    o={0.55}
                  />
                  <Stroke
                    d={`M${polar(cx, cy, 13, a + 0.09)}L${polar(cx, cy, flange - 4, a + 0.06)}`}
                    w={0.5}
                    c="ink"
                    o={0.5}
                  />
                </g>
              );
            })}
            {/* hub */}
            <Stroke d={ring(cx, cy, 9.5)} w={1.1} />
            <Stroke d={ring(cx, cy, 11.5)} w={0.6} c="gloss" o={0.5} />
            <Stroke d={gear(cx, cy, 3.6, 6, 2)} w={0.7} c="ink" />
          </g>
        </g>
      </g>
      <g filter="url(#w-paint)">
        <Arc cx={cx} cy={cy} r={7.5} a0={3.6} a1={5} w={1.4} c="gloss" o={0.8} />
        {/* glint on the flange, from the top-left, and light caught on the far rim */}
        <Arc cx={cx} cy={cy} r={flange - 5} a0={3.35} a1={4.35} w={2.2} c="gloss" o={0.92} />
        <Arc cx={cx + 2} cy={cy - 3} r={flange + 4} a0={3.5} a1={4.4} w={4} c="gloss" o={0.3} />
        <Arc cx={cx} cy={cy} r={flange + 0.5} a0={0.3} a1={1.4} w={2.4} c="blue-light" o={0.6} />
        {/* cream guide lines through the reel */}
        <Stroke
          d={`M${cx - flange - 16} ${cy}H${cx - flange - 3}M${cx + flange + 3} ${cy - 0.6}H${cx + flange + 14}`}
          w={1.5}
          c="cream"
          o={0.75}
        />
        <Stroke
          d={`M${cx - flange - 12} ${cy + 3.5}H${cx - flange - 4}M${cx + flange + 4} ${cy + 3}H${cx + flange + 11}`}
          w={0.6}
          c="cream"
          o={0.5}
        />
      </g>
      <g filter="url(#w-wash)">
        <Fill
          d={`M${polar(cx, cy, 6, 3.9)}a1.6 1 -40 1 0 3 -2a1.6 1 -40 1 0 -3 2`}
          c="gloss"
          o={0.8}
        />
      </g>
    </>
  );
}

export function PluginCartridge({ name, index }: { name: string; index: number }) {
  const no = `No. ${String(index).padStart(2, "0")}`;
  const textW = 136;
  const size = Math.min(16, Math.max(13, textW / em(name)));
  const overflow = em(name) * size > textW + 4;
  const lx = label.x;
  const ly = label.y;
  const lr = label.x + label.w;
  const lb = label.y + label.h;
  const sb = shell.y + shell.h;
  const sr = shell.x + shell.w;

  return (
    <svg
      viewBox="0 0 520 190"
      className="overflow-visible"
      role="img"
      aria-label={`${name} plugin`}
    >
      {/* the whole cartridge, its shadow included; on a change only its label changes and its reels spin */}
      <g>
        {/* 1. flat shadow on the paper, light from the top-left */}
        <g filter="url(#w-flat)">
          <Fill d={cast(rr(shell.x, shell.y, shell.w, shell.h, shell.r), 24, 15)} c="shadow" />
          <Fill d={cast(rr(11, 58, 18, 64, 7), 24, 15)} c="shadow" />
        </g>

        {/* 2. base washes: the cobalt shell, its pull tab and grip */}
        <g filter="url(#w-wash)">
          <Fill d={rr(shell.x, shell.y, shell.w, shell.h, shell.r)} c="indigo-wash" o={0.64} />
          <Fill d={rr(11, 58, 18, 64, 7)} c="indigo-wash" o={0.42} />
        </g>

        {/* 3. form shadows on the side away from the light */}
        <g filter="url(#w-wash)">
          <Fill
            d={`M${sr - 10} ${shell.y + 18}Q${sr - 2} ${shell.y + 22} ${sr} ${shell.y + 34}V${sb - 18}Q${sr} ${sb} ${sr - 18} ${sb}H${shell.x + 22}Q${shell.x + 6} ${sb} ${shell.x + 3} ${sb - 12}Q${shell.x + 120} ${sb - 7} ${shell.x + 260} ${sb - 8}Q${sr - 30} ${sb - 9} ${sr - 9} ${sb - 20}Q${sr - 6} ${shell.y + 80} ${sr - 10} ${shell.y + 18}Z`}
            c="deep"
            o={0.28}
          />
          <Fill d="M14 108Q20 118 28 118V122Q16 122 12 112Z" c="deep" o={0.3} />
          {/* mottling, so the cobalt is not one flat coat */}
          <Fill d="M60 140Q90 136 120 142Q96 150 64 150Z" c="deep" o={0.12} />
          <Fill d="M300 14Q360 12 420 16Q380 24 310 24Z" c="deep" o={0.08} />
          <Fill d="M262 140Q300 136 330 141Q300 152 268 150Z" c="ink" o={0.1} />
          <Fill d="M456 40Q466 70 462 110Q456 80 452 46Z" c="deep" o={0.14} />
          {/* ribbed grip, a shade darker */}
          <Fill d={rr(29, 38, 25, 94, 6)} c="deep" o={0.16} />
          {/* recess around the label, deepest under its top lip */}
          <Fill
            d={`M${lx - 5} ${ly - 4}H${lr + 4}V${ly + 1}H${lx}V${lb + 2}H${lx - 5}Z`}
            c="deep"
            o={0.32}
          />
          {/* a broad sheen across the upper left of the shell */}
          <Fill
            d={`M${shell.x + 8} ${shell.y + 60}Q${shell.x + 10} ${shell.y + 10} ${shell.x + 60} ${shell.y + 8}H${shell.x + 200}Q${shell.x + 90} ${shell.y + 20} ${shell.x + 8} ${shell.y + 60}Z`}
            c="sheet"
            o={0.14}
          />
          {/* the top bevel catches light */}
          <Fill
            d={`M${shell.x + 30} ${shell.y + 3}H${sr - 30}Q${sr - 40} ${shell.y + 12} ${sr - 60} ${shell.y + 14}H${shell.x + 60}Q${shell.x + 34} ${shell.y + 12} ${shell.x + 30} ${shell.y + 3}Z`}
            c="sheet"
            o={0.18}
          />
        </g>

        {/* dark interiors */}
        <g filter="url(#w-wash-dense)">
          <Fill d={rr(win.x, win.y, win.w, win.h, 8)} c="deep" />
          <Fill d={rr(72, 15, 14, 9, 2)} c="deep" />
          <Fill d="M100 160L114 140H230L244 160Z" c="deep" o={0.55} />
        </g>

        {/* the paper label */}
        <g filter="url(#w-wash-dense)">
          <Fill d={rr(lx, ly, label.w, label.h, 3)} c="sheet" />
        </g>
        <g filter="url(#w-wash)">
          <Fill d={rr(lx + 2, ly + 2, label.w - 4, label.h - 4, 3)} c="sheet" o={0.7} />
        </g>
        <g filter="url(#w-wash)">
          <Fill
            d={`M${lr - 7} ${ly + 4}Q${lr - 2} ${ly + 50} ${lr - 2} ${lb - 2}H${lx + 4}Q${lx + 60} ${lb - 6} ${lr - 9} ${lb - 7}Q${lr - 6} ${ly + 50} ${lr - 7} ${ly + 4}Z`}
            c="ink"
            o={0.1}
          />
          <Fill d={rr(306, 93, 6, 6, 1)} c="green" o={0.75} />
        </g>

        {/* window glass: glazes of navy, cobalt and green over the dark */}
        <g filter="url(#w-paint)">
          <Brush d="M72 36V128" w={16} c="label" o={0.5} taper={[0.05, 0.05]} pressure={0.2} />
          <Brush d="M172 36V128" w={44} c="label" o={0.35} taper={[0.04, 0.04]} pressure={0.15} />
          <Brush
            d="M266 36V128"
            w={20}
            c="green-deep"
            o={0.2}
            taper={[0.05, 0.05]}
            pressure={0.12}
          />
          <Brush d="M100 128Q90 90 120 38" w={14} c="indigo-wash" o={0.22} taper={[0.3, 0.3]} />
          <Brush d="M66 33.5H278" w={3.4} c="gloss" o={0.42} taper={[0.012, 0.02]} pressure={0.2} />
          <Brush d="M65.5 36V128" w={3.4} c="gloss" o={0.45} taper={[0.02, 0.03]} />
          <Brush d="M66 131H278" w={2.6} c="gloss" o={0.3} taper={[0.02, 0.03]} />
          <Fill d="M68 36H178C146 58 112 92 90 128H68Z" c="indigo-wash" o={0.3} />
          <Fill d={rr(154, 58, 36, 48, 4)} c="indigo-wash" o={0.35} />
          <Fill d={rr(258, 15, 14, 9, 2)} c="indigo-wash" o={0.5} />
        </g>

        {reels.map((r) => (
          <Reel key={r.cx} cx={r.cx} pack={r.pack} />
        ))}

        <g filter="url(#w-wash)">
          <Fill d={ring(92, 121, 3.5)} c="sheet" o={0.5} />
          <Fill d={ring(252, 121, 3.5)} c="sheet" o={0.5} />
          <Fill d={rr(164, 147, 16, 7, 1.5)} c="green" o={0.7} />
          <g className="w-breathe">
            <Fill d={ring(446, 148, 3.6)} c="green" />
          </g>
        </g>

        <g filter="url(#w-paint)">
          {/* masses of the shell, in strokes of several blues */}
          <Brush
            d="M40 20Q250 17 462 20"
            w={9}
            c="indigo-wash"
            taper={[0.04, 0.04]}
            pressure={0.15}
          />
          <Brush d="M46 26H458" w={4} c="gloss" o={0.3} taper={[0.06, 0.1]} pressure={0.2} />
          <Brush
            d="M27 32Q25 86 27 140"
            w={8}
            c="indigo-wash"
            taper={[0.05, 0.05]}
            pressure={0.15}
          />
          <Brush d="M473 32Q476 86 473 140" w={9} c="label" o={0.8} taper={[0.05, 0.05]} />
          <Brush d="M465 38V134" w={6} c="gloss" o={0.24} taper={[0.08, 0.08]} />
          <Brush d="M288 34V130" w={7} c="label" o={0.4} taper={[0.08, 0.08]} />
          <Brush d="M40 151Q70 152 96 151" w={9} c="label" o={0.7} taper={[0.1, 0.05]} />
          <Brush d="M248 151Q350 153 462 150" w={9} c="label" o={0.7} taper={[0.05, 0.1]} />
          <Brush d="M58 139H98" w={5} c="gloss" o={0.26} taper={[0.1, 0.2]} />
          <Brush d="M250 139H460" w={5} c="gloss" o={0.26} taper={[0.05, 0.2]} />
          <Brush d="M120 18Q200 16 280 18" w={7} c="blue-light" o={0.25} taper={[0.4, 0.4]} />
          <Brush d="M330 19Q380 18 440 20" w={7} c="label" o={0.3} taper={[0.4, 0.4]} />
          <Brush d="M26 70Q25 100 27 130" w={6} c="blue-light" o={0.28} taper={[0.4, 0.4]} />
          <Brush d="M300 152Q360 153 420 151" w={6} c="deep" o={0.25} taper={[0.4, 0.4]} />
          <Brush d="M474 60Q476 90 474 120" w={6} c="blue-light" o={0.2} taper={[0.4, 0.4]} />
          {/* the label lifts off the shell: cool shade along its lower and far edges */}
          <Brush
            d={`M${lx + 6} ${lb - 4}H${lr - 6}`}
            w={5}
            c="blue-light"
            o={0.3}
            taper={[0.15, 0.2]}
            pressure={0.3}
          />
          <Brush
            d={`M${lr - 4} ${ly + 8}V${lb - 8}`}
            w={4}
            c="blue-light"
            o={0.28}
            taper={[0.2, 0.2]}
          />

          {/* 4. occlusion where parts meet */}
          <Stroke
            d={`M${win.x + 2} ${win.y - 1.5}H${win.x + win.w - 2}`}
            w={2.2}
            c="ink"
            o={0.45}
          />
          <Stroke d={`M${win.x - 1.5} ${win.y + 4}V${win.y + win.h - 4}`} w={2} c="ink" o={0.4} />
          <Stroke
            d={`M${lx - 1.5} ${ly + 3}V${lb - 2}M${lx + 3} ${ly - 1.5}H${lr - 2}`}
            w={1.6}
            c="ink"
            o={0.4}
          />
          <Stroke d="M14 60Q12 90 14 118" w={1.6} c="ink" o={0.3} />

          {/* 5. reflected light along the shadow side */}
          <Stroke
            d={`M${shell.x + 22} ${sb - 3.5}Q${shell.x + 230} ${sb - 1} ${sr - 20} ${sb - 4}`}
            w={2.6}
            c="blue-light"
            o={0.45}
          />
          <Stroke
            d={`M${sr - 4} ${shell.y + 30}Q${sr - 1.5} ${shell.y + 80} ${sr - 4} ${sb - 22}`}
            w={2}
            c="blue-light"
            o={0.42}
          />
          <Stroke
            d={`M${win.x + 6} ${win.y + win.h + 2.5}H${win.x + win.w - 4}`}
            w={1.6}
            c="blue-light"
            o={0.45}
          />
          <Stroke
            d={`M${win.x + win.w - 4} ${win.y + 8}V${win.y + win.h - 6}`}
            w={1.4}
            c="blue-light"
            o={0.4}
          />
          <Stroke
            d={`M${lx + 6} ${lb + 2.5}H${lr - 2}M${lr + 2.5} ${ly + 6}V${lb}`}
            w={1.4}
            c="blue-light"
            o={0.45}
          />
          <Stroke d="M27 70Q30 90 27 112" w={1.2} c="blue-light" o={0.4} />

          {/* 6. highlights on the side facing the light */}
          <Stroke
            d={`M${shell.x + 5} ${shell.y + 30}Q${shell.x + 5} ${shell.y + 6} ${shell.x + 30} ${shell.y + 4}`}
            w={1.6}
            c="gloss"
            o={0.85}
          />
          <Stroke
            d={`M${shell.x + 44} ${shell.y + 4}Q${shell.x + 240} ${shell.y + 1.5} ${sr - 40} ${shell.y + 4.5}`}
            w={0.9}
            c="gloss"
            o={0.6}
          />
          <Stroke
            d={`M${shell.x + 70} ${shell.y + 7}Q${shell.x + 160} ${shell.y + 5.5} ${shell.x + 220} ${shell.y + 7}`}
            w={1.6}
            c="gloss"
            o={0.5}
          />
          <Stroke
            d={`M${shell.x + 4} ${shell.y + 40}Q${shell.x + 2.5} ${shell.y + 80} ${shell.x + 4} ${shell.y + 128}`}
            w={1}
            c="gloss"
            o={0.55}
          />
          <Stroke
            d={`M${sr - 12} ${shell.y + 8}Q${sr - 5} ${shell.y + 14} ${sr - 4} ${shell.y + 26}`}
            w={0.8}
            c="gloss"
            o={0.5}
          />
          <Stroke d="M15 66Q13 90 16 114" w={1} c="gloss" o={0.8} />
          <Stroke d={`M${lx + 4} ${ly + 2.5}H${lr - 30}`} w={0.8} c="gloss" o={0.7} />
          <Stroke
            d={`M${shell.x + 120} ${sb - 6}Q${shell.x + 220} ${sb - 4.5} ${shell.x + 300} ${sb - 6}`}
            w={0.6}
            c="gloss"
            o={0.45}
          />

          {/* 7. contours: shell and its bevel, pull tab */}
          <Brush
            d={rr(shell.x, shell.y, shell.w, shell.h, shell.r)}
            w={4}
            c="label"
            loop={3}
            seed={3}
            pressure={0.35}
          />
          <Brush
            d={rr(shell.x + 1, shell.y + 1, shell.w - 2, shell.h - 2, shell.r - 1)}
            w={1.8}
            c="ink"
            o={0.9}
            loop={3}
            seed={11}
          />
          <Brush
            d={`M${shell.x + 5} ${shell.y + 34}Q${shell.x + 2} ${shell.y + 80} ${shell.x + 5} ${sb - 20}`}
            w={3.4}
            c="gloss"
            o={0.9}
            taper={[0.12, 0.55]}
            pressure={0.4}
          />
          <Brush
            d={`M${shell.x + 12} ${shell.y + 40}Q${shell.x + 15} ${shell.y + 80} ${shell.x + 12} ${sb - 30}`}
            w={1.2}
            c="cream"
            o={0.85}
            taper={[0.3, 0.3]}
          />
          <Stroke
            d={rr(shell.x + 5, shell.y + 5, shell.w - 10, shell.h - 10, shell.r - 5)}
            w={0.6}
            c="ink-soft"
            o={0.55}
          />
          <Stroke
            d={`M${shell.x + 5} ${sb - 24}V${shell.y + 22}Q${shell.x + 5} ${shell.y + 5} ${shell.x + 22} ${shell.y + 5}H${shell.x + 120}`}
            w={0.7}
            c="gloss"
            o={0.5}
          />
          <Stroke bold d="M22 58H18Q11 58 11 65V115Q11 122 18 122H22" w={1.3} />
          {[66, 74, 82, 90, 98, 106, 114].map((y) => (
            <Stroke key={y} d={`M13.5 ${y}H20`} w={0.6} c="ink" o={0.55} />
          ))}

          {/* ribbed grip edge: each rib lit on top, inked below */}
          <Stroke d={rr(29, 38, 25, 94, 6)} w={0.9} c="ink-soft" o={0.9} />
          {Array.from({ length: 14 }, (_, i) => {
            const y = 44 + i * 6;
            return (
              <g key={y}>
                <Stroke d={`M32 ${y - 1}Q41.5 ${y - 1.8} 51 ${y - 1}`} w={1} c="gloss" o={0.55} />
                <Stroke
                  d={`M32 ${y + 0.6}Q41.5 ${y - 0.2} 51 ${y + 0.6}`}
                  w={0.8}
                  c="ink"
                  o={0.75}
                />
              </g>
            );
          })}

          {/* write-protect tabs: one broken out, one intact */}
          <Stroke d={rr(72, 15, 14, 9, 2)} w={1} />
          <Stroke d="M74 22L84 17" w={0.5} c="gloss" o={0.4} />
          <Stroke d={rr(258, 15, 14, 9, 2)} w={1} />
          <Stroke d="M260 17H270" w={0.8} c="gloss" o={0.8} />
          <Stroke d="M259 21.5H271" w={0.6} c="ink" o={0.6} />

          {/* knurled ridges and the arrow that says which way it goes in */}
          {Array.from({ length: 16 }, (_, i) => {
            const x = 300 + i * 6;
            return (
              <g key={x}>
                <Stroke d={`M${x} 16.5V24`} w={0.7} c="ink" o={0.55} />
                <Stroke d={`M${x - 1.2} 17V23.5`} w={0.6} c="gloss" o={0.45} />
              </g>
            );
          })}
          <Stroke d="M402 20.5H428M422 16.5L429 20.5L422 24.5" w={1} c="gloss" o={0.7} />
          <Stroke d="M403 22H427" w={0.5} c="ink" o={0.5} />

          {/* window, frame, corner pins */}
          <Stroke bold d={box(win.x, win.y, win.w, win.h, 4)} w={1.5} />
          <Stroke
            d={rr(win.x + 6, win.y + 6, win.w - 12, win.h - 12, 8)}
            w={0.8}
            c="ink-soft"
            o={0.85}
          />
          <Stroke
            d={`M${win.x + 9} ${win.y + 60}V${win.y + 16}Q${win.x + 9} ${win.y + 9} ${win.x + 16} ${win.y + 9}H${win.x + 120}`}
            w={0.6}
            c="gloss"
            o={0.45}
          />
          {[
            [71, 39],
            [273, 39],
            [71, 125],
            [273, 125],
          ].map(([x = 0, y = 0]) => (
            <g key={`${x}-${y}`}>
              <Stroke d={ring(x, y, 3)} w={0.9} c="gloss" o={0.6} />
              <Stroke d={ring(x, y, 0.6)} w={1} c="gloss" o={0.8} />
            </g>
          ))}

          {/* center window with its footage scale */}
          <Stroke d={rr(154, 58, 36, 48, 4)} w={0.9} c="gloss" o={0.6} />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 158 + i * 3.5;
            return (
              <Stroke
                key={x}
                d={`M${x} 58V${i % 4 === 0 ? 65 : 62}M${x} 106V${i % 4 === 0 ? 99 : 102}`}
                w={0.6}
                c="gloss"
                o={0.6}
              />
            );
          })}
          <Arc cx={118} cy={reelY} r={29} a0={-0.35} a1={0.35} w={1.1} c="gloss" o={0.35} />

          {/* the tape running round the guide pins */}
          <Stroke
            d="M99 105L89.5 119Q89 125 96 125H248Q255 125 254.5 119L239 96"
            w={1.3}
            c="cream"
            o={0.7}
          />
          <Stroke d="M98 126.6H246" w={0.5} c="cream" o={0.4} />
          <Stroke d={`${ring(92, 121, 3.5)}${ring(252, 121, 3.5)}`} w={0.9} c="ink" />
          <Stroke d="M140 129H204V122" w={2.2} c="green-deep" o={0.8} />

          {/* scratches on the glass, crisp and white */}
          <Stroke d="M80 132Q140 78 206 33" w={0.9} c="gloss" o={0.65} />
          <Stroke d="M96 133Q160 82 226 34" w={0.5} c="gloss" o={0.5} />
          <Stroke d="M196 40Q214 64 210 104" w={1.6} c="gloss" o={0.75} />
          <Stroke d="M203 46Q219 70 216 96" w={0.6} c="gloss" o={0.6} />
          <Stroke d="M244 34Q262 80 250 132" w={0.7} c="gloss" o={0.45} />
          <Stroke d="M66 60Q72 44 90 36" w={1.2} c="gloss" o={0.7} />
          <Stroke d="M132 132L170 34" w={0.4} c="gloss" o={0.35} />

          {/* the head opening at the bottom edge */}
          <Stroke bold d="M100 160L114 140H230L244 160" w={1.2} />
          <Stroke d="M117 142H227" w={0.6} c="gloss" o={0.5} />
          <Stroke d={`${ring(126, 151, 3.4)}${ring(218, 151, 3.4)}`} w={1} />
          <Stroke d={`${rr(139, 146, 8, 8, 1)}${rr(197, 146, 8, 8, 1)}`} w={0.9} />
          <Stroke d={rr(164, 147, 16, 7, 1.5)} w={0.8} />

          {/* sprocket holes under the label */}
          {Array.from({ length: 6 }, (_, i) => {
            const x = 304 + i * 22;
            return (
              <g key={x}>
                <Stroke d={rr(x, 145.5, 12, 5.5, 2.2)} w={0.9} />
                <Stroke d={`M${x + 2} ${146.6}H${x + 9}`} w={0.5} c="gloss" o={0.6} />
              </g>
            );
          })}
          <Stroke d={ring(446, 148, 3.6)} w={0.9} />
          <Stroke d={`M${lr + 8} ${ly + 4}V${lb - 4}`} w={0.7} c="ink-soft" o={0.8} />
          <Stroke d={`M${lr + 9.5} ${ly + 6}V${lb - 6}`} w={0.5} c="gloss" o={0.5} />

          {/* the label: rules, brackets */}
          <Stroke d={box(lx, ly, label.w, label.h, 3)} w={1.2} />
          <Stroke d={`M${lx + 9} ${ly + 21}H${lr - 9}`} w={0.6} c="muted" o={0.9} />
          <Stroke d={`M${lx + 9} ${ly + 57}H${lr - 9}`} w={0.9} c="ink-soft" o={0.8} />
          <Stroke d={`M${lx + 9} ${ly + 59.5}H${lr - 9}`} w={0.5} c="ink-soft" o={0.6} />
          {[69, 79, 89].map((dy) => (
            <Stroke
              key={dy}
              d={`M${lx + (dy === 69 ? 22 : 10)} ${ly + dy}H${lr - 16}`}
              w={0.5}
              c="muted"
              o={0.8}
            />
          ))}
          <Stroke d={`M${lx + 8} ${ly + 18}V${ly + 7}H${lx + 19}`} w={1.3} />
          <Stroke d={`M${lr - 8} ${lb - 18}V${lb - 7}H${lr - 19}`} w={1.3} />
          <Stroke d={rr(306, 93, 6, 6, 1)} w={0.7} c="green-deep" />
        </g>

        <g filter="url(#w-wash)">
          {screws.map(([x, y]) => (
            <ScrewWash key={`${x}-${y}`} x={x} y={y} />
          ))}
        </g>
        {/* screw heads, and specular dabs */}
        <g filter="url(#w-paint)">
          {screws.map(([x, y]) => (
            <ScrewStrokes key={`${x}-${y}`} x={x} y={y} />
          ))}
          <Fill d="M30 22Q34 16 44 15Q36 18 32 25Z" c="gloss" o={0.8} />
          <Fill d="M200 40q4 2 5 8q-3 -3 -5 -8Z" c="gloss" o={0.8} />
          <Fill d="M74 46q2 -6 8 -8q-4 4 -6 9Z" c="gloss" o={0.7} />
          <Fill d="M15 62q2 -3 6 -3q-3 2 -4 5Z" c="gloss" o={0.7} />
        </g>

        {/* the type on the label and the shell */}
        <text
          x={lx + 18}
          y={ly + 16}
          fontSize={7}
          letterSpacing={1.6}
          className="fill-w-muted font-mono"
        >
          PLUGIN
        </text>
        <text
          x={lr - 10}
          y={ly + 16}
          fontSize={9}
          textAnchor="end"
          className="fill-w-text font-mono"
        >
          {no}
        </text>
        <text
          x={lx + label.w / 2}
          y={ly + 47}
          fontSize={size}
          textAnchor="middle"
          className="fill-w-text font-serif"
          {...(overflow ? { textLength: textW, lengthAdjust: "spacingAndGlyphs" } : {})}
        >
          {name}
        </text>
        <text
          x={172}
          y={22.5}
          fontSize={6.5}
          letterSpacing={2}
          textAnchor="middle"
          className="fill-w-gloss font-mono"
          opacity={0.7}
        >
          FUMAPRESS · CARTRIDGE
        </text>
        <text
          x={lr - 22}
          y={lb - 9}
          fontSize={8}
          textAnchor="end"
          className="fill-w-muted font-serif italic"
        >
          side A
        </text>
      </g>
    </svg>
  );
}
