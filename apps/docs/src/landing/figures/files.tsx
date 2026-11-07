import type { CSSProperties, ReactNode } from "react";
import { Brush, Fill, VerticalText, circle, ptsOfCircle, rr, cast } from "../pen";

/* figure: files become pages — paper tags on a clipboard, tied to the contents of an open book */

/** right end of the tags, and the column of their eyelets */
const tagEnd = 206;
const eyeX = 193;

interface Row {
  /** shared by the tag, its thread and its entry, for hovering */
  key: string;
  file: string;
  entry: string;
  /** top and height of the tag */
  y: number;
  h: number;
  x: number;
  /** eyelet height */
  eye: number;
  /** text baseline of the sidebar entry */
  ey: number;
  folder?: boolean;
  /** indented under the group above */
  depth?: number;
  /** page number in the contents, and where its leader starts */
  page?: string;
  lead?: number;
}

const rows: Row[] = [
  {
    key: "index",
    file: "index.mdx",
    entry: "Introduction",
    x: 24,
    y: 62,
    h: 46,
    eye: 77,
    ey: 106,
    page: "1",
    lead: 344,
  },
  {
    key: "installation",
    file: "installation.mdx",
    entry: "Installation",
    x: 24,
    y: 120,
    h: 30,
    eye: 135,
    ey: 134,
    page: "4",
    lead: 342,
  },
  {
    key: "guides",
    file: "guides/",
    entry: "Guides",
    x: 24,
    y: 170,
    h: 30,
    eye: 185,
    ey: 164,
    folder: true,
  },
  {
    key: "deploy",
    file: "deploy.mdx",
    entry: "Deploy",
    x: 46,
    y: 214,
    h: 30,
    eye: 229,
    ey: 192,
    depth: 1,
    page: "8",
    lead: 328,
  },
];

/** a shipping tag, its right end clipped where the eyelet is */
function tag(x: number, y: number, w: number, h: number, c = 9) {
  return `M${x + 4} ${y}H${x + w - c}L${x + w} ${y + c}V${y + h - c}L${x + w - c} ${y + h}H${x + 4}Q${x} ${y + h} ${x} ${y + h - 4}V${y + 4}Q${x} ${y} ${x + 4} ${y}Z`;
}

/** a divider card of a card index, with its tab on the top left */
function divider(x: number, y: number, w: number, h: number, c = 9) {
  return `M${x + 4} ${y}H${x + 5}V${y - 6}Q${x + 5} ${y - 10} ${x + 9} ${y - 10}H${x + 60}Q${x + 64} ${y - 10} ${x + 66} ${y - 6}L${x + 69} ${y}H${x + w - c}L${x + w} ${y + c}V${y + h - c}L${x + w - c} ${y + h}H${x + 4}Q${x} ${y + h} ${x} ${y + h - 4}V${y + 4}Q${x} ${y} ${x + 4} ${y}Z`;
}

function thread(r: Row, i: number) {
  const x1 = eyeX + 3;
  const y1 = r.eye + 1;
  const x2 = 251;
  const y2 = r.ey - 4;
  const sag = 16 + i * 2;
  return `M${x1} ${y1}C${x1 + 26} ${y1 + sag} ${x2 - 30} ${y2 + sag * 0.6} ${x2} ${y2}`;
}

/** the wash of the glyph of a file or a folder, painted with its tag */
function GlyphWash({ x, y, folder }: { x: number; y: number; folder?: boolean }) {
  if (folder)
    return (
      <Fill
        d={`M${x} ${y - 6}V${y + 6}H${x + 14}V${y - 3}H${x + 7}L${x + 5} ${y - 6}Z`}
        c="w-f-indigo"
        o={0.6}
      />
    );
  return (
    <>
      <Fill
        d={`M${x} ${y - 7}H${x + 7}L${x + 11} ${y - 3}V${y + 7}H${x}Z`}
        c="w-f-indigo"
        o={0.4}
      />
      <Fill d={`M${x + 7} ${y - 7}V${y - 3}H${x + 11}Z`} c="w-f-deep" o={0.35} />
    </>
  );
}

/** the strokes of the glyph of a file or a folder */
function GlyphStrokes({ x, y, folder }: { x: number; y: number; folder?: boolean }) {
  if (folder)
    return (
      <>
        <Brush
          d={`M${x} ${y - 6}V${y + 6}H${x + 14}V${y - 3}H${x + 7}L${x + 5} ${y - 6}Z`}
          w={1.4}
          loop={2}
        />
        <Brush
          d={`M${x + 1.5} ${y - 1}H${x + 12}`}
          w={1.1}
          c="w-f-gloss"
          o={0.85}
          taper={[0.1, 0.5]}
        />
      </>
    );
  return (
    <>
      <Brush d={`M${x} ${y - 7}H${x + 7}L${x + 11} ${y - 3}V${y + 7}H${x}Z`} w={1.4} loop={2} />
      <Brush d={`M${x + 7} ${y - 7}V${y - 3}H${x + 11}`} w={1.1} taper={[0.2, 0.2]} />
      <Brush d={`M${x + 2.5} ${y + 1}H${x + 8.5}`} w={0.9} c="w-f-soft" taper={[0.1, 0.4]} />
      <Brush d={`M${x + 2.5} ${y + 4}H${x + 7}`} w={0.9} c="w-f-soft" taper={[0.1, 0.4]} />
    </>
  );
}

/** a tag, painted in layers on the board; it settles onto the board in turn */
function Tag({
  r,
  i,
  under,
  children,
}: {
  r: Row;
  i: number;
  under?: ReactNode;
  children?: ReactNode;
}) {
  const w = tagEnd - r.x;
  const d = r.folder ? divider(r.x, r.y, w, r.h) : tag(r.x, r.y, w, r.h);
  const b = r.y + r.h;
  const base = r.y + 20;
  const gx = r.x + (r.folder ? 7 : 8);
  const gy = base - 4;
  return (
    <g data-key={r.key} style={{ "--i": i } as CSSProperties}>
      {under}
      {/* cast shadow on the board */}
      <g filter="url(#w-flat)">
        <g transform="translate(6 4)">
          <Fill d={d} c="w-f-deep" o={0.38} />
        </g>
      </g>
      {/* paper, then the shade of its lower edge and the curl at the clipped end */}
      <g filter="url(#w-wash-dense)">
        <Fill d={d} c="w-f-sheet" />
      </g>
      <g filter="url(#w-wash)">
        {r.folder && <Fill d={d} c="w-f-indigo" o={0.3} />}
        <Fill
          d={`M${r.x + 3} ${b - 5}H${tagEnd - 12}L${tagEnd - 4} ${b - 12}V${b - 8}L${tagEnd - 9} ${b}H${r.x + 4}Q${r.x + 1} ${b} ${r.x + 1} ${b - 3}Z`}
          c="w-f-ink"
          o={0.12}
        />
        <Fill
          d={`M${tagEnd - 22} ${r.y + 2}H${tagEnd - 10}L${tagEnd - 2} ${r.y + 10}V${b - 10}L${tagEnd - 10} ${b - 2}H${tagEnd - 22}Z`}
          c="w-f-ink"
          o={0.06}
        />
        {/* the reinforcement ring */}
        <Fill d={circle(eyeX, r.eye, 7.5)} c="w-f-indigo" o={0.38} />
        <GlyphWash x={gx} y={gy} folder={r.folder} />
      </g>
      <g filter="url(#w-paint)">
        {/* form: a cool shade along the lower edge, light along the top */}
        <Brush
          d={`M${r.x + 4} ${b - 4}H${tagEnd - 10}`}
          w={5}
          c="w-f-blue"
          o={0.28}
          taper={[0.1, 0.25]}
          pressure={0.3}
        />
        <Brush
          d={`M${tagEnd - 6} ${r.y + 9}V${b - 9}`}
          w={4}
          c="w-f-soft"
          o={0.16}
          taper={[0.2, 0.2]}
        />
        {/* ruling of the card, and its margin */}
        {Array.from({ length: Math.floor((r.h - 8) / 10) }, (_, k) => (
          <Brush
            key={k}
            d={`M${r.x + 6} ${r.y + 14 + k * 10 + (r.h > 40 ? 0 : 10)}H${tagEnd - 22}`}
            w={0.9}
            c="w-f-blue"
            o={0.6}
            taper={[0.05, 0.3]}
            pressure={0.3}
          />
        ))}
        <Brush
          d={`M${r.x + 26} ${r.y + 3}V${b - 3}`}
          w={0.9}
          c="w-f-muted"
          o={0.45}
          taper={[0.1, 0.2]}
        />
        {/* lit top edge, shaded lower edge */}
        <Brush
          d={`M${r.x + 5} ${r.y + 1.8}H${tagEnd - 12}`}
          w={1.8}
          c="w-f-gloss"
          o={0.95}
          taper={[0.06, 0.5]}
        />
        <Brush
          d={`M${r.x + 4} ${b - 1.6}H${tagEnd - 11}`}
          w={2.2}
          c="w-f-soft"
          o={0.45}
          taper={[0.2, 0.1]}
        />
        {/* eyelet: ring, the hole through to the board, its glint */}
        <Brush pts={ptsOfCircle(eyeX, r.eye, 5.8)} w={2.6} c="w-f-indigo" o={0.5} />
        <Brush pts={ptsOfCircle(eyeX, r.eye, 1.7)} w={3.6} c="w-f-deep" />
        <Brush pts={ptsOfCircle(eyeX, r.eye, 7.5)} w={1.5} loop={2} seed={i * 5 + 1} />
        <Brush pts={ptsOfCircle(eyeX, r.eye, 3.4)} w={1.2} loop={2} seed={i * 5 + 3} />
        <Brush
          pts={ptsOfCircle(eyeX, r.eye, 5.6, Math.PI * 1.05, Math.PI * 1.55)}
          w={1.8}
          c="w-f-gloss"
          o={0.95}
          taper={[0.15, 0.6]}
        />
        <Brush
          pts={ptsOfCircle(eyeX, r.eye, 5.8, 0.05, 1.5)}
          w={1.8}
          c="w-f-blue"
          o={0.8}
          taper={[0.3, 0.3]}
        />
        <Brush pts={ptsOfCircle(eyeX - 1.6, r.eye - 1.6, 0.5)} w={1.4} c="w-f-gloss" />
        {r.folder && (
          <>
            <Brush
              d={`M${r.x + 14} ${r.y - 5}H${r.x + 40}`}
              w={0.9}
              c="w-f-soft"
              o={0.7}
              taper={[0.1, 0.4]}
            />
            <Brush
              d={`M${r.x + 14} ${r.y - 2}H${r.x + 32}`}
              w={0.9}
              c="w-f-soft"
              o={0.7}
              taper={[0.1, 0.4]}
            />
            <Brush
              d={`M${r.x + 8} ${r.y - 8}H${r.x + 60}`}
              w={1.4}
              c="w-f-gloss"
              o={0.8}
              taper={[0.1, 0.5]}
            />
          </>
        )}
        <GlyphStrokes x={gx} y={gy} folder={r.folder} />
        {/* the outline, painted in three overlapping strokes */}
        <Brush d={d} w={1.9} loop={3} seed={i * 7 + 2} pressure={0.32} />
      </g>
      <text x={r.x + 32} y={base} fontSize={13} className="w-f-text font-mono">
        {r.file}
      </text>
      {children}
    </g>
  );
}

/** the crimp at the end of a thread, seated at the margin in front of an entry */
function Crimp({ y }: { y: number }) {
  return (
    <>
      {/* its flat shadow, moved as its thread's is, so the two meet */}
      <g filter="url(#w-flat)" transform="translate(5 4)">
        <Fill
          d={`${rr(251, y - 3.4, 9, 6.8, 1.6)}M259.5 ${y - 0.9}H264V${y + 0.9}H259.5Z`}
          c="w-f-shadow"
        />
      </g>
      <g filter="url(#w-wash)">
        <Fill d={rr(251, y - 3.4, 9, 6.8, 1.6)} c="w-f-sheet" />
        <Fill d={rr(251, y + 0.6, 9, 2.8, 1.2)} c="w-f-ink" o={0.25} />
      </g>
      <g filter="url(#w-paint)">
        <Brush d={rr(251, y - 3.4, 9, 6.8, 1.6)} w={1.3} loop={2} />
        <Brush d={`M254 ${y - 3}V${y + 3}`} w={0.9} c="w-f-soft" taper={[0.2, 0.2]} />
        <Brush d={`M257 ${y - 3}V${y + 3}`} w={0.9} c="w-f-soft" taper={[0.2, 0.2]} />
        <Brush d={`M252.5 ${y - 1.8}H259`} w={1.1} c="w-f-gloss" o={0.95} taper={[0.1, 0.5]} />
        <Brush d={`M259.5 ${y}H264`} w={1.8} taper={[0, 0.4]} />
      </g>
    </>
  );
}

/** the two leaves of the open book, bowing down into the gutter */
const leftPage =
  "M248 34C292 29 342 30 364 35Q370 37 372 43V279Q370 285 364 285C342 288 292 288 248 286Z";
const rightPage =
  "M502 34C458 29 408 30 386 35Q380 37 378 43V279Q380 285 386 285C408 288 458 288 502 286Z";

/** leather caps on the corners of the boards */
const cornerCaps = [
  "M236 52V31Q236 22 245 22H266Z",
  "M484 22H501Q510 22 510 31V48Z",
  "M236 266V285Q236 294 245 294H262Z",
  "M488 294H501Q510 294 510 285V268Z",
];

/** the ribbon marker, with a notched end */
const ribbon = "M378 24L385 24L391.5 306L387.5 300.5L384.5 306.5Z";

export function FilesFigure() {
  return (
    <svg
      viewBox="0 0 520 312"
      className="block w-full overflow-visible"
      role="img"
      aria-label="Paper tags for the files in content/ (index.mdx with title: Introduction, installation.mdx, the folder guides/ and guides/deploy.mdx) tied by threads to the entries of the table of contents of an open book (Introduction, Installation, the group Guides and Deploy under it), whose facing page is titled Introduction"
    >
      {/* flat shadows on the paper */}
      <g filter="url(#w-flat)">
        <Fill d={cast(rr(8, 30, 208, 236, 14), 20, 14)} c="w-f-shadow" />
        <Fill d={cast(rr(236, 22, 274, 272, 9), 20, 14)} c="w-f-shadow" />
      </g>

      {/* ── the clipboard: an underpainting, then the masses of the board in strokes of blue ── */}
      <g filter="url(#w-wash)">
        <Fill d={rr(8, 30, 208, 236, 14)} c="w-f-indigo" o={0.7} />
        {/* form shadow on the right and lower edges, and a softer one under the clip */}
        <Fill
          d="M204 36Q216 38 216 56V250Q216 266 200 266H24Q10 266 8 254Q20 258 34 258H196Q208 258 208 246V58Q208 44 204 36Z"
          c="w-f-deep"
          o={0.32}
        />
        <Fill d="M40 52H190Q186 62 176 64H54Q44 62 40 52Z" c="w-f-deep" o={0.22} />
        <Fill d={circle(22, 252, 4)} c="w-f-sheet" o={0.8} />
        <Fill d={circle(202, 252, 4)} c="w-f-sheet" o={0.8} />
      </g>
      <g filter="url(#w-paint)">
        {/* left band, turned to the light */}
        <Brush
          d="M14 46Q12 150 15 254"
          w={10}
          c="w-f-indigo"
          taper={[0.05, 0.05]}
          pressure={0.15}
        />
        <Brush d="M19 52Q17 150 19 248" w={7} c="w-f-gloss" o={0.4} taper={[0.08, 0.08]} />
        <Brush d="M17 90Q15 140 18 200" w={5} c="w-f-blue" o={0.3} taper={[0.3, 0.3]} />
        {/* right and lower bands, turned away */}
        <Brush d="M210 50Q213 150 210 252" w={8} c="w-f-label" o={0.75} taper={[0.05, 0.05]} />
        <Brush d="M204 56V246" w={5} c="w-f-gloss" o={0.24} taper={[0.1, 0.1]} />
        <Brush d="M26 259Q112 262 198 258" w={8} c="w-f-label" o={0.7} taper={[0.05, 0.05]} />
        <Brush d="M30 250H194" w={6} c="w-f-gloss" o={0.24} taper={[0.1, 0.2]} />
        {/* top band, and broken patches over the masses */}
        <Brush d="M26 38Q112 35 198 38" w={8} c="w-f-indigo" o={0.9} taper={[0.05, 0.05]} />
        <Brush d="M30 46H196" w={6} c="w-f-gloss" o={0.3} taper={[0.1, 0.2]} />
        <Brush d="M12 120Q11 160 13 200" w={6} c="w-f-label" o={0.3} taper={[0.4, 0.4]} />
        <Brush d="M211 120Q212 170 210 220" w={5} c="w-f-blue" o={0.25} taper={[0.4, 0.4]} />
        <Brush d="M60 260Q100 261 150 259" w={6} c="w-f-blue" o={0.22} taper={[0.4, 0.4]} />
        {/* a broad sheen across the varnished board */}
        <Brush d="M14 140L118 36" w={14} c="w-f-gloss" o={0.14} taper={[0.3, 0.3]} />
        <Brush d="M14 112L86 40" w={5} c="w-f-gloss" o={0.22} taper={[0.3, 0.4]} />
        {/* the rim of the board, in two passes */}
        <Brush
          d={rr(8, 30, 208, 236, 14)}
          w={3.6}
          c="w-f-label"
          loop={3}
          seed={3}
          pressure={0.35}
        />
        <Brush d={rr(9, 31, 206, 234, 13)} w={1.7} c="w-f-ink" o={0.9} loop={3} seed={11} />
        <Brush d={rr(14, 36, 196, 224, 10)} w={1} c="w-f-blue" o={0.5} loop={2} seed={5} />
        {/* highlights, bold to thin, on the lit edges */}
        <Brush
          d="M12 56Q8 150 12 248"
          w={3.4}
          c="w-f-gloss"
          o={0.9}
          taper={[0.12, 0.55]}
          pressure={0.4}
        />
        <Brush d="M16 70Q13 120 16 170" w={1.6} c="w-f-gloss" o={0.7} taper={[0.2, 0.5]} />
        <Brush d="M15 190Q13 215 15 240" w={1.2} c="w-f-cream" o={0.85} taper={[0.3, 0.3]} />
        <Brush d="M12 46Q13 34 28 32" w={3} c="w-f-gloss" o={0.92} taper={[0.2, 0.5]} />
        <Brush d="M34 33Q110 31 190 33" w={2} c="w-f-gloss" o={0.7} taper={[0.2, 0.5]} />
        <Brush d="M212 60Q215 160 211 252" w={2.6} c="w-f-blue" o={0.6} taper={[0.3, 0.3]} />
        <Brush d="M30 263Q120 266 196 262" w={2.2} c="w-f-blue" o={0.55} taper={[0.3, 0.3]} />
        <Brush d="M196 34Q212 38 213 56" w={2.2} c="w-f-gloss" o={0.75} taper={[0.2, 0.5]} />
        {/* ruler along the left edge */}
        {Array.from({ length: 23 }, (_, k) => (
          <Brush
            key={k}
            d={`M14 ${70 + k * 8}H${k % 5 === 0 ? 22 : 18.5}`}
            w={k % 5 === 0 ? 1.4 : 1}
            c="w-f-gloss"
            o={0.65}
            taper={[0, 0.7]}
            pressure={0.1}
          />
        ))}
        {/* scratches in the varnish */}
        <Brush d="M150 232L176 206" w={1.2} c="w-f-gloss" o={0.6} taper={[0.3, 0.4]} />
        <Brush d="M160 240L172 228" w={1} c="w-f-blue" o={0.7} taper={[0.3, 0.4]} />
        <Brush d="M20 120L34 104" w={1} c="w-f-gloss" o={0.55} taper={[0.3, 0.4]} />
        {/* corner rivets */}
        {[22, 202].map((x, k) => (
          <g key={x}>
            <Brush pts={ptsOfCircle(x, 252, 4)} w={1.5} loop={2} seed={k * 3 + 7} />
            <Brush
              pts={ptsOfCircle(x, 252, 2.6, Math.PI * 1.05, Math.PI * 1.6)}
              w={1.2}
              c="w-f-gloss"
              o={0.95}
              taper={[0.2, 0.5]}
            />
            <Brush pts={ptsOfCircle(x, 252, 6.5, 0.2, 1.6)} w={1.6} c="w-f-label" o={0.7} />
          </g>
        ))}
        {/* hanging hole at the foot */}
        <Brush d="M100 255.5H124" w={5.4} c="w-f-deep" taper={[0.15, 0.15]} pressure={0.1} />
        <Brush d={rr(98, 252, 28, 7, 3.5)} w={1.4} loop={2} seed={13} />
        <Brush d="M101 258H122" w={0.9} c="w-f-blue" o={0.6} taper={[0.2, 0.3]} />
      </g>

      {/* the clip */}
      <g filter="url(#w-flat)">
        <Fill d={rr(54, 22, 132, 34, 8)} c="w-f-deep" o={0.35} />
      </g>
      <g filter="url(#w-wash)">
        <Fill d={rr(44, 16, 134, 34, 8)} c="w-f-sheet" />
        <Fill d="M46 38H176V42Q176 50 168 50H54Q46 50 46 42Z" c="w-f-ink" o={0.2} />
        <Fill d={rr(56, 50, 110, 7, 3)} c="w-f-sheet" />
        <Fill d={rr(56, 53, 110, 4, 2)} c="w-f-ink" o={0.28} />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={rr(72, 23, 78, 19, 3)} c="w-f-label" />
      </g>
      <g filter="url(#w-paint)">
        {/* the lever, a bent wire above the plate */}
        <Brush d="M86 20C86 3 136 3 136 20" w={4} taper={[0.1, 0.1]} pressure={0.2} />
        <Brush d="M88 16C90 6 132 6 134 16" w={1.3} c="w-f-gloss" o={0.85} taper={[0.2, 0.5]} />
        {/* the plate: cool shade below, light above, the label glazed */}
        <Brush d="M50 44Q110 47 172 44" w={5} c="w-f-blue" o={0.35} taper={[0.15, 0.2]} />
        <Brush d="M50 21Q110 18 170 21" w={4} c="w-f-gloss" o={0.6} taper={[0.1, 0.4]} />
        <Brush d="M76 37H146" w={4} c="w-f-indigo" o={0.35} taper={[0.2, 0.2]} />
        <Brush d="M76 27H100" w={1.4} c="w-f-gloss" o={0.55} taper={[0.1, 0.5]} />
        <Brush d={rr(72, 23, 78, 19, 3)} w={1.4} loop={2} seed={17} />
        {/* the spring roll under the plate, ribbed */}
        <Brush d={rr(56, 50, 110, 7, 3)} w={1.4} loop={2} seed={19} />
        {Array.from({ length: 13 }, (_, k) => (
          <Brush
            key={k}
            d={`M${63 + k * 8} 50.5V56.5`}
            w={1}
            c="w-f-soft"
            o={0.85}
            taper={[0.2, 0.2]}
          />
        ))}
        {/* plate rim, rivets, glints */}
        <Brush d={rr(44, 16, 134, 34, 8)} w={1.9} loop={3} seed={23} pressure={0.32} />
        <Brush d="M52 19Q110 16 168 19" w={1.6} c="w-f-gloss" o={0.95} taper={[0.1, 0.5]} />
        <Brush d="M175 24Q177 34 173 46" w={2.2} c="w-f-blue" o={0.65} taper={[0.3, 0.3]} />
        {[58, 164].map((x, k) => (
          <g key={x}>
            <Brush pts={ptsOfCircle(x, 33, 5)} w={1.5} loop={2} seed={k * 3 + 29} />
            <Brush pts={ptsOfCircle(x, 33, 0.8)} w={2} c="w-f-deep" />
            <Brush
              pts={ptsOfCircle(x, 33, 3.6, Math.PI * 1.05, Math.PI * 1.6)}
              w={1.3}
              c="w-f-gloss"
              o={0.95}
              taper={[0.2, 0.5]}
            />
            <Brush pts={ptsOfCircle(x, 33, 3.8, 0.1, 1.5)} w={1.3} c="w-f-blue" o={0.7} />
          </g>
        ))}
      </g>
      <text x={111} y={36.6} fontSize={12.5} textAnchor="middle" className="w-f-gloss font-mono">
        content/
      </text>

      {/* the tags, settling in order; the front matter of index.mdx names the page */}
      <Tag r={rows[0]!} i={0}>
        <g filter="url(#w-wash)">
          <Fill d="M85 95H178V109H85Z" c="w-f-green" o={0.5} />
        </g>
        <text x={34} y={104} fontSize={12.5} className="w-f-muted font-mono">
          title:
        </text>
        <text x={86.5} y={104} fontSize={12.5} className="w-f-text font-mono">
          Introduction
        </text>
      </Tag>
      <Tag r={rows[1]!} i={1} />
      <Tag r={rows[2]!} i={2} />
      {/* deploy hangs under its divider */}
      <Tag
        r={rows[3]!}
        i={3}
        under={
          <g filter="url(#w-paint)">
            <Brush d="M34 200V229H46" w={1.6} c="w-f-gloss" o={0.8} taper={[0.1, 0.3]} />
            <Brush d="M35.5 201V230.5H46" w={1.1} c="w-f-blue" o={0.55} taper={[0.2, 0.3]} />
          </g>
        }
      />

      {/* ── the book, open on the table of contents ── */}
      <g filter="url(#w-wash)">
        <Fill d={rr(236, 22, 274, 272, 9)} c="w-f-indigo" o={0.72} />
        {/* form shadow of the boards, and the hollow of the spine */}
        <Fill
          d="M498 26Q510 28 510 42V280Q510 294 494 294H252Q238 294 236 284Q248 288 262 288H492Q502 288 502 276V44Q502 32 498 26Z"
          c="w-f-deep"
          o={0.3}
        />
        <Fill d="M366 22H384V294H366Z" c="w-f-deep" o={0.32} />
      </g>
      <g filter="url(#w-wash-dense)">
        {cornerCaps.map((d) => (
          <Fill key={d} d={d} c="w-f-label" />
        ))}
      </g>
      <g filter="url(#w-paint)">
        {/* masses of the boards */}
        <Brush
          d="M242 40Q240 158 243 278"
          w={9}
          c="w-f-indigo"
          taper={[0.05, 0.05]}
          pressure={0.15}
        />
        <Brush d="M244 46Q242 158 244 272" w={5} c="w-f-gloss" o={0.36} taper={[0.08, 0.08]} />
        <Brush d="M506 40Q509 158 506 278" w={7} c="w-f-label" o={0.75} taper={[0.05, 0.05]} />
        <Brush d="M254 28Q372 25 492 28" w={8} c="w-f-indigo" o={0.9} taper={[0.05, 0.05]} />
        <Brush d="M254 290Q372 293 492 290" w={7} c="w-f-label" o={0.7} taper={[0.05, 0.05]} />
        <Brush d="M375 26V292" w={8} c="w-f-label" o={0.55} taper={[0.03, 0.03]} />
        <Brush d="M300 27Q340 26 380 27" w={6} c="w-f-blue" o={0.22} taper={[0.4, 0.4]} />
        <Brush d="M242 120Q241 160 243 210" w={6} c="w-f-blue" o={0.25} taper={[0.4, 0.4]} />
        <Brush d="M420 291Q450 292 480 290" w={6} c="w-f-deep" o={0.25} taper={[0.4, 0.4]} />
        {/* weave of the cloth */}
        {Array.from({ length: 22 }, (_, k) => (
          <Brush
            key={k}
            d={`M${262 + k * 11} 30L${266 + k * 11} 25`}
            w={0.9}
            c="w-f-gloss"
            o={0.32}
            taper={[0.2, 0.3]}
          />
        ))}
        {Array.from({ length: 18 }, (_, k) => (
          <Brush
            key={k}
            d={`M239 ${62 + k * 11}L244 ${57 + k * 11}`}
            w={0.9}
            c="w-f-gloss"
            o={0.32}
            taper={[0.2, 0.3]}
          />
        ))}
        {/* rims and light on the boards */}
        <Brush
          d={rr(236, 22, 274, 272, 9)}
          w={3.6}
          c="w-f-label"
          loop={3}
          seed={31}
          pressure={0.35}
        />
        <Brush d={rr(237, 23, 272, 270, 8)} w={1.7} c="w-f-ink" o={0.9} loop={3} seed={37} />
        <Brush
          d="M239 52Q236 160 240 270"
          w={3}
          c="w-f-gloss"
          o={0.9}
          taper={[0.12, 0.55]}
          pressure={0.4}
        />
        <Brush d="M252 24.6Q380 22.6 492 25" w={2.2} c="w-f-gloss" o={0.8} taper={[0.1, 0.5]} />
        <Brush d="M506 50Q509 160 506 272" w={2.6} c="w-f-blue" o={0.6} taper={[0.3, 0.3]} />
        <Brush d="M258 291Q380 294 488 290" w={2.4} c="w-f-blue" o={0.55} taper={[0.3, 0.3]} />
        <Brush d="M262 288H360" w={1.1} c="w-f-cream" o={0.7} taper={[0.3, 0.3]} />
        {/* the corner caps, with their glints */}
        {cornerCaps.map((d, k) => (
          <Brush key={d} d={d} w={1.5} loop={2} seed={k * 4 + 41} />
        ))}
        <Brush d="M239 46L258 25" w={1.5} c="w-f-gloss" o={0.9} taper={[0.1, 0.5]} />
        <Brush d="M490 25L507 42" w={1.1} c="w-f-gloss" o={0.65} taper={[0.2, 0.5]} />
        <Brush d="M240 270L256 291" w={1.2} c="w-f-blue" o={0.65} taper={[0.3, 0.3]} />
        <Brush d="M507 274L494 291" w={1.2} c="w-f-blue" o={0.65} taper={[0.3, 0.3]} />
      </g>

      {/* the page block: the leaves below show at the outer and lower edges */}
      <g filter="url(#w-flat)">
        <g transform="translate(-3 4)">
          <Fill d={leftPage} c="w-f-deep" o={0.3} />
        </g>
        <g transform="translate(3 4)">
          <Fill d={rightPage} c="w-f-deep" o={0.3} />
        </g>
      </g>
      <g filter="url(#w-wash-dense)">
        <g transform="translate(-2.5 3)">
          <Fill d={leftPage} c="w-f-sheet" />
        </g>
        <g transform="translate(2.5 3)">
          <Fill d={rightPage} c="w-f-sheet" />
        </g>
      </g>
      <g filter="url(#w-paint)">
        <g transform="translate(-2.5 3)">
          <Brush d={leftPage} w={1.1} c="w-f-soft" loop={2} seed={43} />
        </g>
        <g transform="translate(2.5 3)">
          <Brush d={rightPage} w={1.1} c="w-f-soft" loop={2} seed={47} />
        </g>
        <Brush
          d="M247 286.6C292 289 342 289 364 286.6"
          w={0.8}
          c="w-f-muted"
          o={0.7}
          taper={[0.1, 0.3]}
        />
        <Brush
          d="M249 288.2C292 290.6 342 290.6 365 288.2"
          w={0.8}
          c="w-f-muted"
          o={0.6}
          taper={[0.3, 0.1]}
        />
        <Brush
          d="M503 286.6C458 289 408 289 386 286.6"
          w={0.8}
          c="w-f-muted"
          o={0.7}
          taper={[0.1, 0.3]}
        />
        <Brush
          d="M501 288.2C458 290.6 408 290.6 385 288.2"
          w={0.8}
          c="w-f-muted"
          o={0.6}
          taper={[0.3, 0.1]}
        />
      </g>
      <g filter="url(#w-wash-dense)">
        <Fill d={leftPage} c="w-f-sheet" />
        <Fill d={rightPage} c="w-f-sheet" />
      </g>
      <g filter="url(#w-wash)">
        {/* the leaves bow down into the gutter: two passes of shade, deepest at the fold */}
        <Fill d="M352 32.5Q366 33.5 372 43V279Q366 286.5 352 286.5Z" c="w-f-ink" o={0.05} />
        <Fill d="M362 34.5Q370 37 372 43V279Q370 285 362 285.5Z" c="w-f-ink" o={0.07} />
        <Fill d="M367.5 36Q371 38 372 43V279Q371 284 367.5 285Z" c="w-f-ink" o={0.12} />
        <Fill d="M398 32.5Q384 33.5 378 43V279Q384 286.5 398 286.5Z" c="w-f-ink" o={0.045} />
        <Fill d="M388 34.5Q380 37 378 43V279Q380 285 388 285.5Z" c="w-f-ink" o={0.06} />
        <Fill d="M382.5 36Q379 38 378 43V279Q379 284 382.5 285Z" c="w-f-ink" o={0.1} />
        <Fill d="M488 31C496 32 500 33 502 34V286C498 287 494 287 488 287Z" c="w-f-ink" o={0.06} />
        <Fill
          d="M250 278C292 281 342 281 366 279V285C342 288 292 288 248 286Z"
          c="w-f-ink"
          o={0.06}
        />
        {/* headbands at the ends of the spine, and the seal of the contents */}
        <Fill d={rr(369, 16, 12, 9, 3.5)} c="w-f-green" o={0.85} />
        <Fill d={rr(369, 290, 12, 9, 3.5)} c="w-f-green" o={0.7} />
        <Fill d={rr(340, 250, 17, 17, 2)} c="w-f-seal" o={0.85} />
      </g>
      <g filter="url(#w-paint)">
        {/* the curve of the leaves into the fold, in strokes of cool shade */}
        <Brush d="M364 46Q366 160 364 276" w={7} c="w-f-blue" o={0.18} taper={[0.15, 0.15]} />
        <Brush d="M369.5 44V278" w={3} c="w-f-soft" o={0.22} taper={[0.1, 0.1]} />
        <Brush d="M386 46Q384 160 386 276" w={6} c="w-f-blue" o={0.14} taper={[0.15, 0.15]} />
        <Brush d="M494 44Q497 160 494 278" w={5} c="w-f-blue" o={0.16} taper={[0.2, 0.2]} />
        <Brush
          d="M262 281C300 283.5 340 283.5 362 281.5"
          w={4}
          c="w-f-blue"
          o={0.18}
          taper={[0.2, 0.2]}
        />
        {/* light on the upper leaf edges, the fold and its stitches */}
        <Brush
          d="M252 35.6C292 31.6 340 32 360 36"
          w={1.8}
          c="w-f-gloss"
          o={0.95}
          taper={[0.08, 0.5]}
        />
        <Brush
          d="M390 36C410 32 458 31.6 498 35.6"
          w={1.3}
          c="w-f-gloss"
          o={0.75}
          taper={[0.4, 0.2]}
        />
        <Brush d="M375 40V282" w={1.5} taper={[0.05, 0.05]} pressure={0.2} />
        {Array.from({ length: 9 }, (_, k) => (
          <Brush
            key={k}
            d={`M375 ${56 + k * 26}V${64 + k * 26}`}
            w={2.2}
            c="w-f-soft"
            taper={[0.2, 0.2]}
          />
        ))}
        <Brush d={leftPage} w={1.6} loop={3} seed={53} pressure={0.32} />
        <Brush d={rightPage} w={1.6} loop={3} seed={59} pressure={0.32} />
        {/* headbands */}
        {[16, 290].map((y, k) => (
          <g key={y}>
            {[371.5, 374.5, 377.5].map((x) => (
              <Brush
                key={x}
                d={`M${x} ${y + 1}V${y + 8}`}
                w={1.1}
                c="w-f-green-deep"
                taper={[0.2, 0.2]}
              />
            ))}
            <Brush d={`M372 ${y + 2}H378`} w={1} c="w-f-gloss" o={0.85} taper={[0.1, 0.5]} />
            <Brush d={rr(369, y, 12, 9, 3.5)} w={1.3} loop={2} seed={k * 3 + 61} />
          </g>
        ))}
        {/* the ornament under the heading of the contents */}
        <Brush d="M286 76H304" w={1.1} c="w-f-muted" o={0.8} taper={[0.3, 0.1]} />
        <Brush d="M316 76H334" w={1.1} c="w-f-muted" o={0.8} taper={[0.1, 0.3]} />
        <Brush pts={ptsOfCircle(310, 76, 1.6)} w={1.2} c="w-f-soft" loop={2} seed={67} />
        {/* right leaf: the written lines of the page the index file makes */}
        <Brush d="M394 54H414" w={2} c="w-f-soft" taper={[0.05, 0.4]} />
        <Brush d="M394 91H486" w={1} c="w-f-muted" o={0.75} taper={[0.05, 0.3]} />
        {[106, 116, 126, 136].map((y, k) => (
          <Brush
            key={y}
            d={`M394 ${y}H${[486, 480, 484, 446][k]}`}
            w={1.4}
            c="w-f-soft"
            o={0.6}
            taper={[0.03, 0.3]}
            pressure={0.3}
          />
        ))}
        {[218, 228, 238, 248].map((y, k) => (
          <Brush
            key={y}
            d={`M394 ${y}H${[486, 478, 484, 432][k]}`}
            w={1.4}
            c="w-f-soft"
            o={0.6}
            taper={[0.03, 0.3]}
            pressure={0.3}
          />
        ))}
        <Brush d="M484 146V142" w={1.1} c="w-f-muted" o={0.8} taper={[0.1, 0.3]} />
        <Brush d="M484 206V210" w={1.1} c="w-f-muted" o={0.8} taper={[0.3, 0.1]} />
      </g>

      {/* left leaf: the table of contents */}
      <text
        x={310}
        y={64}
        fontSize={12.5}
        textAnchor="middle"
        letterSpacing={2}
        className="w-f-muted w-serif"
      >
        Contents
      </text>
      <text x={310} y={272} fontSize={12.5} textAnchor="middle" className="w-f-muted w-serif">
        iii
      </text>
      <text
        x={348.5}
        y={259}
        fontSize={12.5}
        textAnchor="middle"
        dominantBaseline="central"
        className="w-f-gloss w-mincho"
      >
        文
      </text>

      {/* right leaf: the title from the front matter, inked after its entry */}
      <text
        x={394}
        y={81}
        fontSize={14}
        className="w-light w-f-text w-serif"
        data-key="index"
        style={{ "--i": 0 } as CSSProperties}
      >
        Introduction
      </text>
      {/* a small painted vignette: mountains, a pale sun, water */}
      <g className="w-light" style={{ "--i": 1 } as CSSProperties}>
        <g filter="url(#w-wash)">
          <Fill d={rr(394, 148, 76, 56, 2)} c="w-f-indigo" o={0.08} />
          <Fill d="M395 194L413 170L421 179L436 160L455 186L469 194Z" c="w-f-indigo" o={0.5} />
          <Fill d="M395 197L405 188L418 194L430 183L447 196L469 192V197Z" c="w-f-deep" o={0.45} />
        </g>
        <g filter="url(#w-paint)">
          {/* shaded flanks, lit ridges, glints on the water */}
          <Brush d="M437 164L452 186" w={5} c="w-f-deep" o={0.3} taper={[0.2, 0.3]} />
          <Brush d="M415 173L420 186" w={4} c="w-f-deep" o={0.25} taper={[0.2, 0.3]} />
          <Brush d="M413 171L406 180" w={1.8} c="w-f-gloss" o={0.95} taper={[0.1, 0.6]} />
          <Brush d="M436 161L430 170" w={1.8} c="w-f-gloss" o={0.95} taper={[0.1, 0.6]} />
          <Brush d="M436 161L440 167" w={1.3} c="w-f-cream" o={0.9} taper={[0.1, 0.6]} />
          <Brush d="M402 199H420" w={1.2} c="w-f-blue" o={0.85} taper={[0.2, 0.3]} />
          <Brush d="M428 201H446" w={1.2} c="w-f-blue" o={0.85} taper={[0.2, 0.3]} />
          <Brush d="M410 202H418" w={1} c="w-f-gloss" o={0.8} taper={[0.2, 0.3]} />
          <Brush
            d="M395 194L413 170L421 179L436 160L455 186L469 194"
            w={1.3}
            taper={[0.1, 0.1]}
            pressure={0.3}
          />
          <Brush d={rr(394, 148, 76, 56, 2)} w={1.4} loop={2} seed={71} />
          <Brush d={rr(391, 145, 82, 62, 3)} w={0.9} c="w-f-soft" loop={2} seed={73} />
        </g>
        {/* the pale sun breathes */}
        <g className="w-breathe">
          <g filter="url(#w-wash)">
            <Fill d={circle(452, 164, 6)} c="w-f-green" o={0.85} />
          </g>
        </g>
      </g>
      <VerticalText
        x={484}
        y={156}
        glyphs={["は", "じ", "め", "に"]}
        size={12.5}
        gap={3}
        className="w-f-muted w-mincho"
      />
      {/* the caret at the end of the text, still being written */}
      <g className="w-blink">
        <Brush d="M437 242V252" w={1.8} taper={[0.1, 0.2]} />
      </g>
      <text x={440} y={272} fontSize={12.5} textAnchor="middle" className="w-f-muted w-serif">
        1
      </text>

      {/* the ribbon marker, from the head of the spine across the page and out under the foot */}
      <g filter="url(#w-flat)">
        <g transform="translate(3 2.5)">
          <Fill d={ribbon} c="w-f-deep" o={0.2} />
        </g>
      </g>
      <g>
        <g filter="url(#w-wash)">
          <Fill d={ribbon} c="w-f-green" o={0.85} />
          <Fill d="M383.5 24L385 24L391.5 306L389 302Z" c="w-f-ink" o={0.18} />
        </g>
        <g filter="url(#w-paint)">
          <Brush d="M384.5 30L390 298" w={2.2} c="w-f-green-deep" o={0.6} taper={[0.1, 0.1]} />
          <Brush d="M379.8 30L386 296" w={1.4} c="w-f-gloss" o={0.85} taper={[0.05, 0.5]} />
          <Brush d="M381 120L383 200" w={0.9} c="w-f-cream" o={0.9} taper={[0.3, 0.3]} />
          <Brush d={ribbon} w={1.2} c="w-f-green-deep" loop={2} seed={79} />
        </g>
      </g>

      {/* threads: a dark cord with a pale core, and its flat shadow, from each eyelet to its entry */}
      <g filter="url(#w-ink)">
        {rows.map((r, i) => {
          const d = thread(r, i);
          const anim = (paint: { c?: string; s?: string }, w: number, shift?: string) => (
            <path
              d={d}
              pathLength={1}
              className={paint.c ? `w-thread ${paint.c}` : "w-thread"}
              strokeWidth={w}
              fill="none"
              strokeLinecap="round"
              transform={shift}
              style={{ "--i": i, stroke: paint.s } as CSSProperties}
            />
          );
          return (
            <g key={r.file} data-key={r.key}>
              {anim({ s: "var(--w-shadow)" }, 2.4, "translate(5 4)")}
              {anim({ c: "w-s-ink" }, 2.4)}
              {anim({ c: "w-s-blue" }, 0.8, "translate(0.3 -0.5)")}
            </g>
          );
        })}
      </g>

      {/* the entries of the contents, with dotted leaders to their page numbers */}
      {rows.map((r, i) => (
        <g key={r.entry} data-key={r.key} style={{ "--i": i } as CSSProperties}>
          <Crimp y={r.ey - 4} />
          <text
            x={r.depth ? 282 : 268}
            y={r.ey}
            fontSize={r.folder ? 13 : 12.5}
            fontStyle={r.folder ? "italic" : undefined}
            className={r.folder ? "w-f-muted w-serif" : "w-f-text w-serif"}
          >
            {r.entry}
          </text>
          {r.page && (
            <>
              <path
                d={`M${r.lead} ${r.ey - 1}H357`}
                className="w-s-rule"
                strokeWidth={1.3}
                strokeDasharray="0.1 3.4"
                strokeLinecap="round"
                fill="none"
              />
              <text x={364} y={r.ey} fontSize={12.5} textAnchor="end" className="w-f-text w-serif">
                {r.page}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
