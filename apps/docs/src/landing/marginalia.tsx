import type { ReactNode } from "react";
import { cn } from "../cn";
import { Brush, Line, Sketch, circle, rr, cast } from "./pen";
import { InView } from "./landing.client";
import { Sheet } from "./sheet";

/**
 * Small objects beside the text of the chapters, each one recognizable at a glance: the file you write, the mail
 * that brings pages in, a binder's swatches of cloth, and the colophon.
 */

/* 原稿: the file you write, on manuscript paper, with the pen still lying on it */

const sheet = { x: 8, y: 8, w: 344, h: 226 };
const grid = { x0: 20, x1: 340, y0: 44, y1: 222, step: 18 };

function gridLines() {
  let d = "";
  for (let x = grid.x0; x <= grid.x1; x += grid.step) d += `M${x} ${grid.y0}V${grid.y1}`;
  for (let y = grid.y0; y <= grid.y1; y += grid.step) d += `M${grid.x0} ${y}H${grid.x1}`;
  return d;
}

export function MdxManuscript() {
  return (
    <svg
      viewBox="0 0 384 262"
      className="mt-10 w-full max-w-sm overflow-visible"
      role="img"
      aria-label="A page of manuscript paper with the file content/deploy.mdx written on it: front matter, a line of prose, and a Callout component between the lines, marked with a green highlighter; a fountain pen lies across it"
    >
      {/* the flat shadow of the page */}
      <g filter="url(#w-flat)">
        <path
          d={cast(rr(sheet.x, sheet.y, sheet.w, sheet.h, 3), 12, 9)}
          className="fill-w-shadow"
        />
      </g>
      {/* the page, its edge a little ragged */}
      <g transform="rotate(-1.4 180 121)">
        <g filter="url(#w-ink)">
          <path d={rr(sheet.x, sheet.y, sheet.w, sheet.h, 2)} className="fill-w-sheet" />
        </g>
        {/* the squares of manuscript paper, printed faintly in indigo */}
        <g filter="url(#w-ink)">
          <path
            d={gridLines()}
            fill="none"
            className="stroke-w-blue-light"
            strokeWidth={0.5}
            opacity={0.55}
          />
          <Line
            d={rr(grid.x0, grid.y0, grid.x1 - grid.x0, grid.y1 - grid.y0, 0)}
            w={0.8}
            c="blue-light"
            o={0.8}
          />
          <Sketch d={rr(sheet.x, sheet.y, sheet.w, sheet.h, 2)} w={0.9} />
        </g>
        {/* the highlighter over the component, a pale green wash */}
        <g filter="url(#w-wash)">
          <path
            d="M22 141Q60 139 104 141L103 158Q60 160 23 158Z"
            className="fill-w-green"
            opacity={0.42}
          />
          <path
            d="M22 195Q62 193 110 195L109 212Q62 214 23 212Z"
            className="fill-w-green"
            opacity={0.42}
          />
        </g>

        <text x={22} y={32} fontSize={11} className="font-mono fill-w-muted">
          content/deploy.mdx
        </text>
        <g fontSize={11.5} className="font-mono">
          <text x={24} y={63} className="fill-w-muted">
            ---
          </text>
          <text x={24} y={81}>
            <tspan className="fill-w-muted">title: </tspan>
            <tspan className="fill-w-ink">Deploy</tspan>
          </text>
          <text x={24} y={99} className="fill-w-muted">
            ---
          </text>
        </g>
        <text x={24} y={128} fontSize={14} className="font-serif fill-w-ink">
          Push to main, and the site goes live.
        </text>
        <text x={26} y={154} fontSize={11.5} className="font-mono fill-w-ink">
          {"<Callout>"}
        </text>
        <text x={40} y={182} fontSize={14} className="font-serif fill-w-ink">
          Every pull request gets a preview.
        </text>
        <text x={26} y={208} fontSize={11.5} className="font-mono fill-w-ink">
          {"</Callout>"}
        </text>
      </g>

      {/* the pen, put down across the corner of the page */}
      <g transform="translate(318 214) rotate(-32)">
        <path
          d="M-74 -5.5H44Q52 -5.5 52 0.5Q52 6.5 44 6.5H-74Z"
          transform="translate(5 7)"
          className="fill-w-shadow-glaze"
        />
        <g filter="url(#w-wash)">
          {/* the barrel, the cap and its band */}
          <path
            d="M-62 -5.5H44Q52 -5.5 52 0.5Q52 6.5 44 6.5H-62Z"
            className="fill-w-deep"
            opacity={0.88}
          />
          <path d="M-60 -4H46Q50 -3.5 50.5 -1H-60Z" className="fill-w-gloss" opacity={0.3} />
          <path d="M-60 3.5H50Q49 6 46 6H-60Z" className="fill-w-deep" opacity={0.5} />
          <path d={rr(-8, -6, 7, 13, 1)} className="fill-w-cream" opacity={0.85} />
          {/* the section and the nib */}
          <path d="M-62 -4.5L-74 -2.6V3.6L-62 5.5Z" className="fill-w-ink-soft" />
          <path d="M-74 -2.4L-86 0.5L-74 3.4Z" className="fill-w-cream" />
        </g>
        <g filter="url(#w-paint)">
          <Brush d="M-56 -2.4H42" w={1.6} c="gloss" o={0.6} taper={[0.1, 0.4]} />
          <Brush
            d="M-62 -5.5H44Q52 -5.5 52 0.5Q52 6.5 44 6.5H-62"
            w={1.1}
            c="ink"
            taper={[0.05, 0.05]}
          />
          <Brush d="M-62 -4.5L-74 -2.6V3.6L-62 5.5" w={0.9} c="ink" taper={[0.1, 0.1]} />
          <Brush d="M-74 -2.4L-86 0.5L-74 3.4" w={0.8} c="ink" taper={[0.1, 0.1]} />
          <Brush d="M-86 0.5L-77 0.5" w={0.5} c="ink" taper={[0.2, 0.2]} />
          {/* the clip of the cap */}
          <Brush d="M2 -7.5H38Q41 -7.5 41 -5" w={1.4} c="ink-soft" taper={[0.1, 0.2]} />
          <Brush d="M4 -8H36" w={0.6} c="gloss" o={0.8} taper={[0.2, 0.4]} />
        </g>
      </g>
    </svg>
  );
}

/* 丁合: pages arriving by mail, from each source to its address on the site */

/** fanned down the page, so the sender and the address of each one show above the next */
const letters = [
  { from: "Notion", to: "/guides", tilt: -3, x: 0, y: 0 },
  { from: "Obsidian", to: "/notes", tilt: 2, x: 22, y: 46 },
  { from: "Sanity", to: "/blog", tilt: -1.5, x: 44, y: 92 },
];

function Envelope({ from, to }: { from: string; to: string }) {
  return (
    <div className="relative h-26 w-54 overflow-hidden">
      <p className="font-serif absolute top-2 left-3 text-xs text-w-muted">from {from}</p>
      {/* the address on the site */}
      <p className="absolute top-5.5 left-3 font-mono text-sm text-w-ink">{to}</p>
      {/* the stamp, perforated, and its postmark */}
      <span
        className="absolute top-2 right-2.5 flex h-9 w-8 items-center justify-center border border-dashed border-w-ink/40 bg-w-paper"
        aria-hidden
      >
        <span className="font-serif text-sm text-w-seal">文</span>
      </span>
      <svg viewBox="0 0 60 30" className="absolute top-4 right-7 h-7 w-14" aria-hidden>
        <circle
          cx={18}
          cy={15}
          r={11}
          fill="none"
          className="stroke-w-seal"
          strokeWidth={1}
          opacity={0.6}
        />
        <path
          d="M30 9Q38 6 46 9T60 9M30 15Q38 12 46 15T60 15M30 21Q38 18 46 21T60 21"
          fill="none"
          className="stroke-w-seal"
          strokeWidth={0.9}
          opacity={0.55}
        />
      </svg>
    </div>
  );
}

export function Envelopes() {
  return (
    <div
      className="relative mt-10 h-50 max-w-sm"
      role="img"
      aria-label="Pages arriving by mail: from Notion to /guides, from Obsidian to /notes, from Sanity to /blog"
    >
      {letters.map((letter) => (
        <Sheet
          key={letter.from}
          className="absolute w-fit"
          style={{ left: letter.x, top: letter.y, rotate: `${letter.tilt}deg` }}
        >
          <Envelope from={letter.from} to={letter.to} />
        </Sheet>
      ))}
    </div>
  );
}

/* 装丁: a binder's fan of cloth swatches, one swung out from the rest */

const pivot = { x: 46, y: 214 };
const strip = { from: -20, to: 196, w: 34 };
/** under to top: the fan of the other bindings, then the chosen one swung well apart */
const swatches = [
  { angle: -88, paint: "fill-w-deep" },
  { angle: -79, paint: "fill-w-indigo-wash" },
  { angle: -70, paint: "fill-w-blue-light" },
  { angle: -61, paint: "fill-w-seal" },
  { angle: -52, paint: "fill-w-cream" },
  { angle: -27, paint: "fill-w-green" },
];

function Swatch({ angle, paint }: { angle: number; paint: string }) {
  const { from, to, w } = strip;
  const half = w / 2;
  const shape = rr(from, -half, to - from, w, 7);
  return (
    <g transform={`translate(${pivot.x} ${pivot.y}) rotate(${angle})`}>
      {/* the flat shadow, darker where it falls on the strip below */}
      <path d={shape} transform="translate(5 4)" className="fill-w-shadow-glaze" />
      <path d={shape} className="fill-w-sheet" />
      {/* the cloth, laid on in a wash at the free end */}
      <g filter="url(#w-wash)">
        <path d={rr(to - 82, -half + 5, 76, w - 10, 3)} className={paint} />
      </g>
      <g filter="url(#w-ink)">
        <Sketch d={shape} w={1.1} />
        {/* the printed lines of the swatch number and the cloth's name */}
        <Line d={`M24 -6H${to - 108}M24 3H${to - 128}`} w={1} c="rule" o={0.7} />
      </g>
    </g>
  );
}

export function SwatchFan() {
  return (
    <svg
      viewBox="0 0 300 240"
      className="my-8 w-full max-w-2xs overflow-visible"
      role="img"
      aria-label="A fan of cloth swatches for binding a book, with one swung out from the rest"
    >
      {swatches.map((s) => (
        <Swatch key={s.angle} {...s} />
      ))}
      {/* the rivet the strips turn on */}
      <circle cx={pivot.x} cy={pivot.y} r={7} className="fill-w-ink-soft" />
      <circle
        cx={pivot.x}
        cy={pivot.y}
        r={7}
        fill="none"
        className="stroke-w-ink"
        strokeWidth={1.2}
      />
      <circle cx={pivot.x - 2} cy={pivot.y - 2.2} r={2} className="fill-w-gloss" opacity={0.7} />
    </svg>
  );
}

/* 奥付: the colophon slip lying on the closed book, with the seal that stamped it */

const colophonRows: [string, string][] = [
  ["Written by", "Fuma Nama"],
  ["Built on", "Fumadocs"],
  ["License", "MIT"],
];

export function Colophon({ className }: { className?: string }) {
  // the book, the slip on it, and the seal lying beside its mark
  const book = { x: 8, y: 22, w: 352, h: 214 };
  const slip = { x: 62, y: 46, w: 238, h: 156 };
  const mark = { x: slip.x + 202, y: slip.y + 116 };
  return (
    <svg
      viewBox="0 0 392 262"
      className={cn("w-full overflow-visible", className)}
      role="img"
      aria-label="The colophon on a slip of paper lying on a closed cloth-bound book: Fumapress, a press for your words, written by Fuma Nama, built on Fumadocs, MIT license, stamped with the author's red seal; the seal lies beside it"
    >
      {/* 1. the flat shadow of the book on the page */}
      <g filter="url(#w-flat)">
        <path
          d={cast(rr(book.x, book.y, book.w, book.h + 6, 8), 18, 13)}
          className="fill-w-shadow"
        />
      </g>

      {/* 2. the book: the page block showing at the fore-edge and the foot, then the cloth of the cover */}
      <path d={rr(book.x + 6, book.y + 6, book.w, book.h, 5)} className="fill-w-cream" />
      <g filter="url(#w-ink)">
        {[0, 2.2, 4.4].map((o) => (
          <path
            key={o}
            d={`M${book.x + book.w + 1 + o * 0.5} ${book.y + 12}V${book.y + book.h + 2 + o * 0.6}H${book.x + 14}`}
            fill="none"
            className="stroke-w-ink-soft"
            strokeWidth={0.45}
            opacity={0.55}
          />
        ))}
      </g>
      <path d={rr(book.x, book.y, book.w, book.h, 6)} className="fill-w-paper" />
      <g filter="url(#w-wash)">
        <path
          d={rr(book.x, book.y, book.w, book.h, 6)}
          className="fill-w-indigo-wash"
          opacity={0.72}
        />
        {/* the spine, wrapped round the boards, in shade */}
        <path d={rr(book.x, book.y, 34, book.h, 6)} className="fill-w-deep" opacity={0.34} />
        {/* light across the near board, form shadow on the far edge */}
        <path
          d={`M${book.x + 40} ${book.y + 6}H${book.x + 200}Q${book.x + 120} ${book.y + 30} ${book.x + 44} ${book.y + 96}Z`}
          className="fill-w-gloss"
          opacity={0.14}
        />
        <path
          d={`M${book.x + book.w - 18} ${book.y + 4}Q${book.x + book.w - 2} ${book.y + 6} ${book.x + book.w - 2} ${book.y + 24}V${book.y + book.h - 6}H${book.x + book.w - 10}Z`}
          className="fill-w-deep"
          opacity={0.3}
        />
      </g>
      <g filter="url(#w-paint)">
        {/* the cloth, brushed along the grain, and the groove where the board meets the spine */}
        <Brush
          d={`M${book.x + 8} ${book.y + 10}V${book.y + book.h - 10}`}
          w={5}
          c="gloss"
          o={0.25}
          taper={[0.05, 0.1]}
        />
        <Brush
          d={`M${book.x + 36} ${book.y + 6}V${book.y + book.h - 6}`}
          w={2.4}
          c="deep"
          o={0.55}
          taper={[0.05, 0.05]}
        />
        <Brush
          d={`M${book.x + 40} ${book.y + 8}V${book.y + book.h - 8}`}
          w={1.4}
          c="gloss"
          o={0.4}
          taper={[0.1, 0.1]}
        />
        <Brush
          d={`M${book.x + 60} ${book.y + 12}H${book.x + 300}`}
          w={6}
          c="blue-light"
          o={0.18}
          taper={[0.3, 0.4]}
        />
        <Brush
          d={`M${book.x + 90} ${book.y + book.h - 14}H${book.x + 330}`}
          w={8}
          c="deep"
          o={0.16}
          taper={[0.3, 0.3]}
        />
        {/* the rim of the boards, in two passes */}
        <Brush
          d={rr(book.x, book.y, book.w, book.h, 6)}
          w={2.6}
          c="label"
          loop={2}
          seed={23}
          pressure={0.3}
        />
        <Brush
          d={rr(book.x + 0.6, book.y + 0.6, book.w - 1.2, book.h - 1.2, 5.5)}
          w={1.3}
          c="ink"
          o={0.9}
          loop={2}
          seed={29}
        />
        <Brush
          d={`M${book.x + 14} ${book.y + 2.6}H${book.x + book.w - 16}`}
          w={1}
          c="gloss"
          o={0.6}
          taper={[0.1, 0.3]}
        />
        {/* bands across the spine */}
        {[30, book.h - 30].map((y) => (
          <Brush
            key={y}
            d={`M${book.x + 4} ${book.y + y}H${book.x + 32}`}
            w={1.6}
            c="cream"
            o={0.7}
            taper={[0.1, 0.1]}
          />
        ))}
      </g>

      {/* 3. the slip, a little askew, its shadow darkening the cloth */}
      <g transform={`rotate(-2.2 ${slip.x + slip.w / 2} ${slip.y + slip.h / 2})`}>
        <path d={rr(slip.x + 7, slip.y + 6, slip.w, slip.h, 2)} className="fill-w-shadow-glaze" />
        <g filter="url(#w-ink)">
          <path d={rr(slip.x, slip.y, slip.w, slip.h, 2)} className="fill-w-sheet" />
        </g>
        <g filter="url(#w-ink)">
          <Line d={rr(slip.x + 10, slip.y + 10, slip.w - 20, slip.h - 20, 1)} w={1.3} o={0.8} />
          <Sketch d={rr(slip.x + 14, slip.y + 14, slip.w - 28, slip.h - 28, 1)} w={0.5} />
          <Line d={`M${slip.x + 26} ${slip.y + 72}H${slip.x + 166}`} w={0.5} c="ink-soft" o={0.7} />
          {/* 検印: the box where the author stamps each copy */}
          <Sketch d={rr(mark.x - 21, mark.y - 34, 42, 54, 1)} w={0.7} />
          <Line d={`M${mark.x - 21} ${mark.y - 21}H${mark.x + 21}`} w={0.6} />
        </g>
        <text x={slip.x + 26} y={slip.y + 46} fontSize={22} className="font-serif fill-w-ink">
          Fumapress
        </text>
        <text
          x={slip.x + 26}
          y={slip.y + 63}
          fontSize={11.5}
          className="font-serif fill-w-muted italic"
        >
          A press for your words
        </text>
        {colophonRows.map(([term, value], i) => (
          <g key={term} className="font-serif">
            <text x={slip.x + 26} y={slip.y + 92 + i * 18} fontSize={11.5} className="fill-w-muted">
              {term}
            </text>
            <text x={slip.x + 92} y={slip.y + 92 + i * 18} fontSize={12.5} className="fill-w-ink">
              {value}
            </text>
          </g>
        ))}
        <text
          x={mark.x}
          y={mark.y - 24.5}
          fontSize={8}
          textAnchor="middle"
          className="font-serif fill-w-ink-soft"
        >
          検印
        </text>
        {/* the mark of the seal: red paste, the character left in the paper */}
        <g transform={`rotate(-9 ${mark.x} ${mark.y})`} filter="url(#w-wash)">
          <circle cx={mark.x} cy={mark.y} r={12.5} className="fill-w-seal" opacity={0.85} />
          <circle
            cx={mark.x}
            cy={mark.y}
            r={10.2}
            fill="none"
            className="stroke-w-cream"
            strokeWidth={0.7}
            opacity={0.8}
          />
          <text
            x={mark.x}
            y={mark.y + 4.8}
            fontSize={14}
            textAnchor="middle"
            className="font-serif fill-w-sheet"
          >
            文
          </text>
        </g>
      </g>

      {/* 4. the seal itself, lying on the book where it was put down: a stone rod, its red face toward us */}
      <g transform="translate(300 214) rotate(-24)">
        <path
          d="M-50 -4H40Q46 -4 46 6Q46 16 40 16H-50Z"
          transform="translate(5 6)"
          className="fill-w-shadow-glaze"
        />
        <g filter="url(#w-wash)">
          <path d="M-50 -4H40Q46 -4 46 6Q46 16 40 16H-50Z" className="fill-w-deep" opacity={0.85} />
          <path d="M-48 -2H38Q42 -1 43 3H-48Z" className="fill-w-gloss" opacity={0.3} />
          <path d="M-48 11H42Q41 15 38 15H-48Z" className="fill-w-deep" opacity={0.5} />
          <ellipse cx={-50} cy={6} rx={4.5} ry={10} className="fill-w-seal" />
        </g>
        <g filter="url(#w-paint)">
          <Brush d="M-44 1H36" w={1.8} c="gloss" o={0.6} taper={[0.1, 0.4]} />
          <Brush d="M-30 6H-26M-12 6H-8" w={1} c="cream" o={0.35} taper={[0.2, 0.2]} />
          <Brush d="M-50 -4H40Q46 -4 46 6Q46 16 40 16H-50" w={1.2} c="ink" taper={[0.05, 0.05]} />
          <Brush d="M-50 -4Q-55 6 -50 16" w={1} c="ink" taper={[0.1, 0.1]} />
          <Brush d="M-36 -4Q-38 6 -36 16" w={0.7} c="cream" o={0.5} taper={[0.2, 0.2]} />
        </g>
      </g>
    </svg>
  );
}

/* the welcome: the colophon at the centre of a ring of words, turning slowly while it is in view */

const RING = { c: 300, r: 262 };
const ringPath = `M${RING.c} ${RING.c - RING.r}a${RING.r} ${RING.r} 0 1 1 0 ${RING.r * 2}a${RING.r} ${RING.r} 0 1 1 0 ${-RING.r * 2}`;
// six times round at its natural spacing (measured: one turn of r 262 holds six at 22px, 0.12em); en spaces, which
// SVG keeps, around each dot
const greeting = "Welcome to Fumapress\u2002·\u2002".repeat(6);

/** the ring of words around the colophon */
export function WelcomeRing() {
  return (
    <svg viewBox="0 0 600 600" className="absolute inset-0 size-full overflow-visible" aria-hidden>
      <defs>
        <path id="w-welcome-ring" d={ringPath} />
      </defs>
      <g filter="url(#w-ink)" fill="none">
        <Sketch d={circle(RING.c, RING.c, 250)} w={0.8} c="ink-soft" />
        <Sketch d={circle(RING.c, RING.c, 286)} w={1.1} />
        <Line d={circle(RING.c, RING.c, 290)} w={0.5} c="ink-soft" o={0.6} />
      </g>
      <text fontSize={22} className="font-serif fill-w-ink italic" letterSpacing="0.12em">
        <textPath
          href="#w-welcome-ring"
          textLength={Math.round(2 * Math.PI * RING.r)}
          lengthAdjust="spacing"
        >
          {greeting}
        </textPath>
      </text>
    </svg>
  );
}

/** the welcome at the end of the page; `ring` and `colophon` are `WelcomeRing` and `Colophon`, as the page draws them */
export function Welcome({ ring, colophon }: { ring: ReactNode; colophon: ReactNode }) {
  return (
    <InView
      // round, so the turning square of the ring never reaches past the page
      className="relative mx-auto aspect-square w-full max-w-md overflow-clip rounded-full"
    >
      {ring}
      <p className="sr-only">Welcome to Fumapress</p>
      <div className="absolute inset-0 flex items-center justify-center">{colophon}</div>
    </InView>
  );
}
