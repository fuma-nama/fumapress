"use client";

import {
  type RefObject,
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Link } from "fumapress/client";
import { cn } from "../cn";
import { PluginCartridge } from "./figures/cartridge";
import { Layered } from "./pen";

/**
 * The path of the cord through the plugs under `root`, in the root's own units. Self-contained, so the inline script
 * of `CordLayer` can run the same code before the page hydrates.
 */
function drawCord(root: HTMLElement): string | undefined {
  type Point = { x: number; y: number };
  // a Catmull-Rom curve through the points, as cubic Bézier segments
  const curve = (pts: Point[]) => {
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p0 = pts[i - 1] ?? p1;
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const box = root.getBoundingClientRect();
  // in the root's own units, even when an ancestor is scaled
  const scale = box.width / (root.offsetWidth || box.width) || 1;
  const wide = window.matchMedia("(min-width: 1280px)").matches;
  const anchors = Array.from(root.querySelectorAll<HTMLElement>("[data-cord]")).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: (r.left + r.width / 2 - box.left) / scale,
      y: (r.top + r.height / 2 - box.top) / scale,
      kind: el.dataset.cord,
      wander: el.dataset.wander?.split(",").map(Number),
    };
  });
  if (anchors.length < 2) return;
  // the left edge of the column, where the sheets with plugs start
  let column = Infinity;
  for (const el of root.querySelectorAll<HTMLElement>('[data-cord="in"], [data-cord="out"]')) {
    const sheet = el.parentElement?.offsetParent;
    if (sheet) column = Math.min(column, sheet.getBoundingClientRect().left);
  }
  if (!Number.isFinite(column)) column = 7;

  const first = anchors[0]!;
  let path = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    // inside a figure nothing shows: the cord lifts at the plug and resumes at the next one
    if (a.kind === "in") {
      path += `M${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      continue;
    }

    const gap = b.y - a.y;
    let pts: Point[];
    if (wide) {
      const [w1 = 0.5, w2 = 0.5] = a.wander ?? [];
      pts = [
        a,
        { x: a.x, y: a.y + Math.min(48, gap * 0.12) },
        { x: (w1 * box.width) / scale, y: a.y + gap * 0.36 },
        { x: (w2 * box.width) / scale, y: a.y + gap * 0.68 },
        { x: b.x, y: b.y - Math.min(56, gap * 0.12) },
        b,
      ];
    } else {
      // down a gutter just left of the column, clear of the text, then across the space above the figure;
      // never closer than 7px to the edge of the page
      const g = Math.max(7, column - 12) / scale - box.left / scale;
      pts = [
        a,
        { x: a.x, y: a.y + 20 },
        { x: g, y: a.y + Math.min(70, gap * 0.2) },
        { x: g, y: b.y - 28 },
        { x: b.x, y: b.y - 6 },
        b,
      ];
    }
    path += curve(pts);
  }
  return path;
}

/**
 * Draws the cord as soon as the markup above it is parsed, before the first paint and before hydration, so the plugs
 * never show without it. React keeps the attribute until its own measurement replaces it.
 */
const drawEarly = `(function(){var s=document.currentScript,r=s&&s.parentElement;if(!r)return;var d=(${drawCord.toString()})(r);if(d)r.querySelectorAll(":scope>svg>path").forEach(function(p){p.setAttribute("d",d)})})()`;

/**
 * One long cord down the page. It leaves the press of the hero, runs behind each figure through
 * its plugs (`data-cord="in"`, `data-cord="out"`), and ends at `data-cord="end"`.
 */
export function CordLayer({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [d, setD] = useState<string>();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const update = () => {
      const path = drawCord(root);
      if (path) setD(path);
    };
    // once a frame at most, however many boxes resize together
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    // a sheet can change its height without changing the page's, as the plugin card does
    for (const el of root.querySelectorAll<HTMLElement>("[data-cord]")) {
      // the plug's box, positioned on the sheet it is fixed to
      const sheet = el.parentElement?.offsetParent;
      if (sheet) observer.observe(sheet);
    }
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* above cast shadows on the paper, below the sheets and plugs (z-index 1, later in the tree) */}
      <svg
        className="pointer-events-none absolute inset-0 z-1 size-full overflow-visible"
        aria-hidden
      >
        {/* the inline script below sets `d` before hydration */}
        <path d={d} className="w-cord-shadow" suppressHydrationWarning />
        <path d={d} className="w-cord" suppressHydrationWarning />
        <path d={d} className="w-cord-core" suppressHydrationWarning />
      </svg>
      <div className="relative">{children}</div>
      {/* the server and client bundles compile `drawCord` differently; only the server's copy runs */}
      <script dangerouslySetInnerHTML={{ __html: drawEarly }} suppressHydrationWarning />
    </div>
  );
}

/** whether the element is on screen now, for ambient motion */
function useVisible(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? false),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

/** runs the ambient motion of its children while they are on screen */
export function Alive({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);
  return (
    <div ref={ref} className={className} data-visible={visible ? "" : undefined}>
      {children}
    </div>
  );
}

/**
 * Marks the figure with `data-inview` once it is in the view, and starts its SVG animations.
 * Hovering a part with `data-key` marks every part with that key (`w-on`).
 */
export function InView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const visible = useVisible(ref);
  const [hovering, setHovering] = useState<string>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setInView(true);
      },
      // once its top passes 3/4 of the viewport: a ratio threshold can't be met by a figure taller than the screen
      { threshold: 0, rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const part of el.querySelectorAll<Element>("[data-key]")) {
      part.classList.toggle("w-on", part.getAttribute("data-key") === hovering);
    }
  }, [hovering]);

  return (
    <div
      ref={ref}
      className={className}
      data-inview={inView ? "" : undefined}
      data-visible={visible ? "" : undefined}
      data-hovering={hovering}
      onPointerOver={(e) => {
        const key = (e.target as Element).closest("[data-key]")?.getAttribute("data-key");
        setHovering(key ?? undefined);
      }}
      onPointerLeave={() => setHovering(undefined)}
    >
      {children}
    </div>
  );
}

export function CopyCommand({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(command).then(() => {
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        "group inline-flex items-center gap-3 font-mono text-[13px] text-(--w-text) transition-colors",
        className,
      )}
      aria-label={`Copy ${command}`}
    >
      <span className="text-(--w-muted) select-none">$</span>
      <span>{command}</span>
      <span className="text-(--w-muted) transition-colors group-hover:text-(--w-ink)">
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </span>
    </button>
  );
}

/* the plugin index: a table of contents, and the setup of the chosen plugin */

export interface PluginEntry {
  id: string;
  name: string;
  short: string;
  description: ReactNode;
  docsHref: string;
  html: string;
}

const PluginContext = createContext<{
  plugins: PluginEntry[];
  active: string;
  setActive: (id: string) => void;
} | null>(null);

function usePlugins() {
  const ctx = use(PluginContext);
  if (!ctx) throw new Error("missing <PluginIndex />");
  return ctx;
}

export function PluginIndex({
  plugins,
  children,
}: {
  plugins: PluginEntry[];
  children: ReactNode;
}) {
  const [active, setActive] = useState(plugins[0]?.id ?? "");
  return <PluginContext value={{ plugins, active, setActive }}>{children}</PluginContext>;
}

export function PluginList() {
  const { plugins, active, setActive } = usePlugins();

  return (
    <ol className="mt-10 border-t border-(--w-rule)/40">
      {plugins.map((plugin, i) => (
        <li key={plugin.id}>
          <button
            type="button"
            onClick={() => setActive(plugin.id)}
            aria-pressed={plugin.id === active}
            className={cn(
              "group flex w-full items-baseline py-2.5 text-left text-[15px] hover:transition-colors",
              plugin.id === active ? "text-(--w-ink)" : "text-(--w-muted) hover:text-(--w-text)",
            )}
          >
            <span className="w-serif w-7 shrink-0 text-[14px] text-(--w-muted)">{i + 1}</span>
            <span className="w-serif text-[17px]">{plugin.name}</span>
            <span className="w-leader" />
            <span className="w-serif shrink-0 text-[15px]">{plugin.short}</span>
            <span
              className={cn(
                "ml-2 size-1.5 shrink-0 self-center rounded-full",
                plugin.id === active ? "bg-(--w-green-deep)" : "bg-transparent",
              )}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Code that changes like a sheet fed through the press: the new code comes in from the top while the old one leaves
 * below the same line, so the block is never blank. The box eases from the old height to the new one on the same clock.
 */
function CodeFeed({ id, html }: { id: string; html: string }) {
  const [sheets, setSheets] = useState([{ id, html }]);
  if (sheets.at(-1)!.id !== id) setSheets([sheets.at(-1)!, { id, html }]);
  const feeding = sheets.length > 1;
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!feeding) {
      el.style.height = "";
      return;
    }
    const [old, next] = el.children as unknown as [HTMLElement, HTMLElement];
    const from = old.offsetHeight;
    const to = next.offsetHeight;
    // both clips run on one line, measured against the taller sheet
    el.style.setProperty("--feed-h", `${Math.max(from, to)}px`);
    el.style.height = `${from}px`;
    void el.offsetHeight;
    el.style.height = `${to}px`;
  }, [feeding, sheets]);

  return (
    <div ref={box} className="w-feed relative overflow-hidden">
      {sheets.map((sheet, i) => (
        <div
          key={sheet.id}
          className={cn(
            "w-code",
            feeding && (i === 0 ? "w-feed-out absolute inset-x-0 top-0" : "w-feed-in"),
          )}
          onAnimationEnd={i === 1 ? () => setSheets((all) => all.slice(-1)) : undefined}
          dangerouslySetInnerHTML={{ __html: sheet.html }}
        />
      ))}
    </div>
  );
}

export function PluginCard({ top, bottom }: { top?: ReactNode; bottom?: ReactNode }) {
  const { plugins, active } = usePlugins();
  const index = Math.max(
    0,
    plugins.findIndex((p) => p.id === active),
  );
  const plugin = plugins[index]!;

  return (
    <>
      {/* the cartridge stands on the page, the cord plugged into it */}
      <div className="relative">
        {top}
        <Layered key={plugin.id}>
          <PluginCartridge name={plugin.name} index={index + 1} />
        </Layered>
      </div>
      {/* and its setup on a slip below */}
      <div className="relative mt-6">
        <div className="w-sheet-shadow" aria-hidden />
        <div className="w-sheet">
          <p className="w-serif px-5 pt-4 text-[15px]/[1.6] text-(--w-muted)">
            {plugin.description}
          </p>
          <p className="mt-4 border-t border-(--w-ink)/25 px-5 pt-3 font-mono text-xs text-(--w-muted)">
            press.config.tsx
          </p>
          <CodeFeed id={plugin.id} html={plugin.html} />
          <div className="border-t border-(--w-ink)/25 px-5 py-3 w-serif text-[15px]">
            <Link href={plugin.docsHref} className="w-link text-(--w-ink)">
              Read the {plugin.name} docs
            </Link>
          </div>
          {bottom}
        </div>
      </div>
    </>
  );
}
