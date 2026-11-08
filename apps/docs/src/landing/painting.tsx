/**
 * The large figures as cached SVG files. The static painting of a figure leaves the page: each run of its top-level
 * groups is drawn into an SVG file per theme, cropped to its content, and shown as an `<img>`. What the page styles stays
 * inline, in drawing order between the images: the groups with an intro, the type (so it keeps the page's fonts), and
 * groups that a hover key reaches inside. A group with its own hover key gets an image of its own, which dims on hover.
 *
 * Server only: the page and the route that serves the files run the same code, so each file's name carries the hash of
 * its content and stays cached until the drawing changes.
 */
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { WakuAppShape, WakuPlugin } from "fumapress";
import washi from "./washi.css?raw";
import { InkDefs, Layered, hasIntro, paintingOf, type Props } from "./pen";
import { HeroPress } from "./ink";
import { FilesFigure } from "./figures/files";
import { SourcesFigure } from "./figures/sources";
import { LayoutsFigure } from "./figures/layouts";

const figures = {
  hero: () => <HeroPress className="h-auto w-full" />,
  files: () => <FilesFigure />,
  sources: () => <SourcesFigure />,
  layouts: () => <LayoutsFigure />,
};

export type FigureName = keyof typeof figures;

const themes = ["light", "dark"] as const;
type Theme = (typeof themes)[number];

/** a run of top-level groups: drawn into a file, or kept inline */
type Layer =
  | { image: false; intro: boolean; nodes: ReactNode[] }
  | { image: true; hoverKey?: string; nodes: ReactNode[] };

/** an image layer as a file: its markup per theme, its crop and the type lifted out of it */
interface ImageFile {
  svg: Record<Theme, string>;
  box: Box;
  hash: string;
  texts: ReactNode[];
}

/* the layers of a painting */

function hoverKeyOf(node: ReactNode): string | undefined {
  if (!isValidElement<Props>(node)) return;
  const key = node.props["data-key"];
  return typeof key === "string" ? key : undefined;
}

function hasHoverKey(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasHoverKey);
  if (!isValidElement<Props>(node)) return false;
  return hoverKeyOf(node) !== undefined || hasHoverKey(node.props.children);
}

function layersOf(painting: ReactElement<Props>): Layer[] {
  const layers: Layer[] = [];
  for (const node of Children.toArray(painting.props.children)) {
    const hoverKey = hoverKeyOf(node);
    const last = layers.at(-1);
    if (hasIntro(node) || (!hoverKey && hasHoverKey(node))) {
      if (last && !last.image) {
        last.nodes.push(node);
        last.intro ||= hasIntro(node);
      } else layers.push({ image: false, intro: hasIntro(node), nodes: [node] });
    } else if (!hoverKey && last?.image && last.hoverKey === undefined) last.nodes.push(node);
    else layers.push({ image: true, hoverKey, nodes: [node] });
  }
  return layers;
}

/** the type of a node, each in copies of the groups around it, and the node without it */
function liftText(node: ReactNode, chain: ReactElement<Props>[], texts: ReactNode[]): ReactNode {
  if (Array.isArray(node)) return node.map((child) => liftText(child, chain, texts));
  if (!isValidElement<Props>(node)) return node;
  if (node.type === "text") {
    texts.push(
      chain.reduceRight<ReactNode>(
        (inner, group) => cloneElement(group, { key: texts.length }, inner),
        cloneElement(node, { key: texts.length }),
      ),
    );
    return null;
  }
  const { children } = node.props;
  if (children === undefined) return node;
  const rest = liftText(children, [...chain, node], texts);
  return Array.isArray(rest) ? cloneElement(node, {}, ...rest) : cloneElement(node, {}, rest);
}

/* the bounds of a drawing, to crop its file */

type Box = [x0: number, y0: number, x1: number, y1: number];
type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

const identity: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

function parseTransform(value: unknown): Matrix {
  let m = identity;
  if (typeof value !== "string") return m;
  for (const [, name, args] of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (name === "translate") m = multiply(m, [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]);
    else if (name === "scale") m = multiply(m, [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]);
    else if (name === "matrix") m = multiply(m, v as Matrix);
    else if (name === "rotate") {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      const [cx = 0, cy = 0] = v.slice(1);
      m = multiply(m, [1, 0, 0, 1, cx, cy]);
      m = multiply(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
      m = multiply(m, [1, 0, 0, 1, -cx, -cy]);
    }
  }
  return m;
}

/** the points that bound a path: its ends and control points, and the reach of its arcs */
function pathPoints(d: string): [number, number][] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  const arity: Record<string, number> = {
    m: 2,
    l: 2,
    h: 1,
    v: 1,
    c: 6,
    s: 4,
    q: 4,
    t: 2,
    a: 7,
    z: 0,
  };
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = "";
  for (let i = 0; i < tokens.length;) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const lower = cmd.toLowerCase();
    const rel = cmd !== cmd.toUpperCase();
    const n = arity[lower] ?? 0;
    if (lower === "z") {
      x = sx;
      y = sy;
      continue;
    }
    const v = tokens.slice(i, i + n).map(Number);
    i += n;
    if (v.length < n) break;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (lower === "h") x = ox + v[0]!;
    else if (lower === "v") y = oy + v[0]!;
    else if (lower === "a") {
      const r = Math.max(Math.abs(v[0]!), Math.abs(v[1]!));
      pts.push([x - r, y - r], [x + r, y + r]);
      x = ox + v[5]!;
      y = oy + v[6]!;
      pts.push([x - r, y - r], [x + r, y + r]);
    } else {
      for (let k = 0; k < n - 2; k += 2) pts.push([ox + v[k]!, oy + v[k + 1]!]);
      x = ox + v[n - 2]!;
      y = oy + v[n - 1]!;
    }
    pts.push([x, y]);
    if (lower === "m") {
      sx = x;
      sy = y;
      cmd = rel ? "l" : "L";
    }
  }
  return pts;
}

function grow(box: Box, by: number): Box {
  return [box[0] - by, box[1] - by, box[2] + by, box[3] + by];
}

function union(a: Box | undefined, b: Box | undefined): Box | undefined {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function boundsOf(node: ReactNode, m: Matrix): Box | undefined {
  if (Array.isArray(node))
    return node.reduce<Box | undefined>((box, child) => union(box, boundsOf(child, m)), undefined);
  if (!isValidElement<Props>(node)) return;
  const p = node.props;
  const local = multiply(m, parseTransform(p.transform));
  const num = (v: unknown) => Number(v ?? 0);
  let pts: [number, number][] = [];
  if (node.type === "path" && typeof p.d === "string") pts = pathPoints(p.d);
  else if (node.type === "circle" || node.type === "ellipse") {
    const rx = num(p.r ?? p.rx);
    const ry = num(p.r ?? p.ry);
    pts = [
      [num(p.cx) - rx, num(p.cy) - ry],
      [num(p.cx) + rx, num(p.cy) + ry],
    ];
  } else if (node.type === "rect")
    pts = [
      [num(p.x), num(p.y)],
      [num(p.x) + num(p.width), num(p.y) + num(p.height)],
    ];
  else if (node.type === "line")
    pts = [
      [num(p.x1), num(p.y1)],
      [num(p.x2), num(p.y2)],
    ];

  let box: Box | undefined;
  for (const [px, py] of pts) {
    const x = local[0] * px + local[2] * py + local[4];
    const y = local[1] * px + local[3] * py + local[5];
    box = union(box, [x, y, x, y]);
  }
  if (box && p.strokeWidth) box = grow(box, num(p.strokeWidth) * Math.hypot(local[0], local[1]));
  box = union(box, boundsOf(p.children, local));
  // a filter paints past its element: by its region (up to 8% each side) and displacement
  if (box && p.filter) box = grow(box, 6 + 0.08 * Math.max(box[2] - box[0], box[3] - box[1]));
  return box;
}

/* SVG markup */

/** React props that stay camel-cased as SVG attributes; the others become kebab-cased */
const camelAttributes = new Set([
  "viewBox",
  "pathLength",
  "baseFrequency",
  "numOctaves",
  "stdDeviation",
  "xChannelSelector",
  "yChannelSelector",
  "filterUnits",
  "primitiveUnits",
  "gradientUnits",
  "gradientTransform",
  "preserveAspectRatio",
  "tableValues",
  "stitchTiles",
  "surfaceScale",
  "specularExponent",
  "specularConstant",
  "diffuseConstant",
  "kernelMatrix",
  "lengthAdjust",
  "textLength",
]);
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** the colors of the page's tokens (`--w-*`) per theme, read from washi.css */
const tokens: Record<Theme, Map<string, string>> = (() => {
  const read = (selector: string) => {
    const start = washi.indexOf(`${selector} {`);
    const block = washi.slice(start, washi.indexOf("\n}", start));
    return new Map(
      [...block.matchAll(/--w-([a-z0-9-]+):\s*([^;]+);/g)]
        .filter(([, , value]) => !value!.startsWith("url("))
        .map(([, name, value]) => [name!, value!.trim()]),
    );
  };
  const light = read(":root:has([data-washi])");
  return { light, dark: new Map([...light, ...read(".dark:has([data-washi])")]) };
})();

const resolveVars = (value: string, theme: Theme) =>
  value.replace(
    /var\(--w-([a-z0-9-]+)\)/g,
    (match, name: string) => tokens[theme].get(name) ?? match,
  );

function markup(node: ReactNode, theme: Theme, classes: Set<string>, filters: Set<string>): string {
  if (Array.isArray(node))
    return node.map((child) => markup(child, theme, classes, filters)).join("");
  if (typeof node === "string" || typeof node === "number") return escape(String(node));
  if (!isValidElement<Props>(node)) return "";
  const { children, ...props } = node.props;
  const inner = markup(children, theme, classes, filters);
  if (typeof node.type !== "string") return inner;
  let attrs = "";
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (name.startsWith("data-") || name.startsWith("aria-") || name === "role") continue;
    if (name === "className") {
      for (const c of String(value).split(/\s+/)) if (c) classes.add(c);
      attrs += ` class="${escape(String(value))}"`;
    } else if (name === "style") {
      const css = Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !k.startsWith("--"))
        .map(([k, v]) => `${kebab(k)}:${resolveVars(String(v), theme)}`)
        .join(";");
      if (css) attrs += ` style="${escape(css)}"`;
    } else {
      const text = resolveVars(String(value), theme);
      if (name === "filter") filters.add(text.replace(/^url\(#|\)$/g, ""));
      attrs += ` ${camelAttributes.has(name) ? name : kebab(name)}="${escape(text)}"`;
    }
  }
  return `<${node.type}${attrs}${inner ? `>${inner}</${node.type}>` : "/>"}`;
}

/** the filters of `InkDefs`, by id */
const inkFilters = new Map(
  Children.toArray(
    (InkDefs().props.children as ReactElement<Props>).props.children as ReactNode,
  ).flatMap((filter) =>
    isValidElement<Props>(filter) && typeof filter.props.id === "string"
      ? [[filter.props.id, filter] as const]
      : [],
  ),
);

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const round = (n: number) => Math.round(n * 100) / 100;

function imageFile(nodes: ReactNode[]): ImageFile | undefined {
  const texts: ReactNode[] = [];
  const drawing = liftText(nodes, [], texts);
  const bounds = boundsOf(drawing, identity);
  if (!bounds) return;
  const box = grow(bounds, 2).map(round) as Box;
  const svg = {} as Record<Theme, string>;
  for (const theme of themes) {
    const classes = new Set<string>();
    const filters = new Set<string>();
    const body = markup(drawing, theme, classes, filters);
    const colors = [...classes].flatMap((c) => {
      const match = /^(fill|stroke)-w-([a-z0-9-]+)$/.exec(c);
      const color = match && tokens[theme].get(match[2]!);
      return color ? [`.${c}{${match[1]}:${color}}`] : [];
    });
    const defs = [...filters]
      .map((id) => markup(inkFilters.get(id), theme, new Set(), new Set()))
      .join("");
    const [x0, y0, x1, y1] = box;
    svg[theme] =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${round(x1 - x0)} ${round(y1 - y0)}" width="${round(x1 - x0)}" height="${round(y1 - y0)}">` +
      `<style>${colors.join("")}</style><defs>${defs}</defs>${body}</svg>`;
  }
  return { svg, box, hash: fnv(svg.light + svg.dark), texts };
}

/* the figures, once per server */

interface Figure {
  painting: ReactElement<Props>;
  layers: Layer[];
  files: Map<number, ImageFile>;
}

const cache = new Map<FigureName, Figure>();

function figure(name: FigureName): Figure | undefined {
  let out = cache.get(name);
  if (!out) {
    const painting = paintingOf(figures[name]());
    if (!painting) return;
    const layers = layersOf(painting);
    const files = new Map<number, ImageFile>();
    layers.forEach((layer, i) => {
      if (!layer.image) return;
      const file = imageFile(layer.nodes);
      if (file) files.set(i, file);
    });
    out = { painting, layers, files };
    cache.set(name, out);
  }
  return out;
}

const fileName = (name: FigureName, index: number, file: ImageFile, theme: Theme) =>
  `${name}-${index}-${file.hash}-${theme}.svg`;
const route = "/_figures";

/* the page */

function paintLayers(name: FigureName, painting: ReactElement<Props>): ReactNode {
  const data = figure(name);
  if (!data) return painting;
  const { viewBox } = painting.props;
  const [vx = 0, vy = 0, vw = 1, vh = 1] = String(viewBox).split(/\s+/).map(Number);
  const percent = (n: number) => `${round(n * 100)}%`;
  const out: ReactNode[] = [cloneElement(painting, { key: "size" }, null)];
  data.layers.forEach((layer, i) => {
    if (!layer.image) {
      out.push(
        <svg
          key={i}
          viewBox={viewBox as string}
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          {layer.nodes}
        </svg>,
      );
      return;
    }
    const file = data.files.get(i);
    if (!file) return;
    const [x0, y0, x1, y1] = file.box;
    const style = {
      left: percent((x0 - vx) / vw),
      top: percent((y0 - vy) / vh),
      width: percent((x1 - x0) / vw),
      height: percent((y1 - y0) / vh),
    };
    for (const theme of themes)
      out.push(
        <img
          key={`${i}-${theme}`}
          src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}${route}/${fileName(name, i, file, theme)}`}
          alt=""
          data-key={layer.hoverKey}
          className={`absolute max-w-none ${theme === "light" ? "dark:hidden" : "hidden dark:block"}`}
          style={style}
        />,
      );
    if (file.texts.length > 0)
      out.push(
        <svg
          key={`${i}-type`}
          viewBox={viewBox as string}
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          {file.texts}
        </svg>,
      );
  });
  return out;
}

/**
 * A large figure with its static painting in cached files, see the top of this module. `inline` keeps the painting in
 * the page instead, for a figure in the first screen, which must show with the first paint.
 */
export function Painting({
  name,
  className,
  inline,
}: {
  name: FigureName;
  className?: string;
  inline?: boolean;
}) {
  return (
    <Layered
      className={className}
      paint={inline ? undefined : (painting) => paintLayers(name, painting)}
    >
      {figures[name]()}
    </Layered>
  );
}

/* the files */

/** serves the files of the figures, prerendered with the site */
export function paintingPlugin<C extends WakuAppShape>(): WakuPlugin<C> {
  return {
    name: "docs:painting",
    routes({ createApi }) {
      const names = Object.keys(figures) as FigureName[];
      const paths = names.flatMap((name) =>
        [...(figure(name)?.files ?? [])].flatMap(([i, file]) =>
          themes.map((theme) => fileName(name, i, file, theme)),
        ),
      );
      createApi({
        path: `${route}/[file]`,
        render: "static",
        staticPaths: paths,
        GET(_request, { params }) {
          const match = /^([a-z]+)-(\d+)-([a-z0-9]+)-(light|dark)\.svg$/.exec(String(params.file));
          const file = match && figure(match[1] as FigureName)?.files.get(Number(match[2]));
          if (!match || !file || file.hash !== match[3])
            return new Response("Not found", { status: 404 });
          return new Response(file.svg[match[4] as Theme], {
            headers: {
              "content-type": "image/svg+xml",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        },
      });
    },
  };
}
