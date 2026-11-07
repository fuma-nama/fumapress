"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

/** a CSS `cubic-bezier()` as a function of progress */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

const ease = bezier(0.4, 0, 0.2, 1);

const noop = () => () => {};

/**
 * Whether the component renders on the server or hydrates its HTML, when an inline script of it runs before the first
 * paint. A script React adds on the client never runs, so it is left out then.
 */
export function useEarly(): boolean {
  return useSyncExternalStore(
    noop,
    () => false,
    () => true,
  );
}

/**
 * Crops a part's box to the bounds of its drawing, once; a turning part gets a square around its centre. Returns false
 * when the part can't be measured yet. Self-contained, so the inline script of `Parts` can run it before the first paint.
 */
function crop(part: HTMLElement): boolean {
  if (part.hasAttribute("data-cropped")) return true;
  const svg = part.firstElementChild;
  const root = svg?.firstElementChild;
  if (!(svg instanceof SVGSVGElement) || !(root instanceof SVGGraphicsElement)) return false;
  const box = root.getBBox();
  // copied: `baseVal` is live and changes with the viewBox set below
  const { x: vx, y: vy, width: vw, height: vh } = svg.viewBox.baseVal;
  if (!box.width || !box.height || !vw) return false;
  let { x, y, width: w, height: h } = box;
  if (/\bw-turn/.test(part.className)) {
    const r = Math.hypot(w, h) / 2 + 2;
    x += w / 2 - r;
    y += h / 2 - r;
    w = h = r * 2;
  } else {
    x -= 2;
    y -= 2;
    w += 4;
    h += 4;
  }
  svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  part.style.inset = "auto";
  part.style.left = `${((x - vx) / vw) * 100}%`;
  part.style.top = `${((y - vy) / vh) * 100}%`;
  part.style.width = `${(w / vw) * 100}%`;
  part.style.height = `${(h / vh) * 100}%`;
  part.setAttribute("data-cropped", "");
  return true;
}

/**
 * Crops the parts while the page is parsed, before the first paint, so hydration has nothing to move and the page has
 * no layout shift. `Parts` crops what this could not measure.
 */
const cropEarly = `(function(){var o=document.currentScript&&document.currentScript.parentElement;if(o)o.querySelectorAll(":scope>[data-part]").forEach(${crop.toString()})})()`;

/**
 * The keyframes of a part travelling its path once per cycle, in pixels of the overlay: it grows out of the start,
 * runs the path eased in and out, shrinks into the end, then stays hidden until the next cycle.
 */
function travel(
  part: HTMLElement,
  path: SVGPathElement,
  overlay: HTMLElement,
  view: DOMRect,
): Keyframe[] {
  const share = Number(part.dataset.share ?? 1);
  const sx = overlay.clientWidth / view.width;
  const sy = overlay.clientHeight / view.height;
  const half = part.offsetWidth / 2;
  const length = path.getTotalLength();
  const frames: Keyframe[] = [];
  const steps = 48;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const p = path.getPointAtLength(ease(t) * length);
    const scale =
      t < 0.18 ? 0.05 + 0.95 * (t / 0.18) : t > 0.82 ? 1 - 0.95 * ((t - 0.82) / 0.18) : 1;
    frames.push({
      offset: t * share,
      opacity: 1,
      transform: `translate(${((p.x - view.x) * sx - half).toFixed(2)}px, ${((p.y - view.y) * sy - half).toFixed(2)}px) scale(${scale.toFixed(3)})`,
    });
  }
  const last = frames[frames.length - 1]!;
  frames.push(
    { ...last, offset: Math.min(1, share + 0.001), opacity: 0 },
    { ...last, offset: 1, opacity: 0 },
  );
  return frames;
}

/**
 * Runs the moving parts of a `Layered` figure, once on mount. Each box is cropped to its part, so the compositor
 * layer it animates in is the size of the part. Parts that travel a path (`data-travel`) get a Web Animation of
 * `transform` and `opacity` along it, which runs on the compositor too; they start when the figure comes into view,
 * pause while it is off screen, and follow its size.
 */
export function Parts() {
  const ref = useRef<HTMLSpanElement>(null);
  const early = useEarly();

  useLayoutEffect(() => {
    const overlay = ref.current?.parentElement;
    if (!overlay) return;
    // `crop` runs once per part: the effect can run twice in development, and a second crop would measure the first
    for (const part of overlay.querySelectorAll<HTMLElement>(":scope > [data-part]")) crop(part);

    const travellers = [...overlay.querySelectorAll<HTMLElement>(":scope > [data-travel-part]")];
    const figure = overlay.previousElementSibling?.querySelector("svg");
    if (
      travellers.length === 0 ||
      !figure ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const view = figure.viewBox.baseVal;
    const box = new DOMRect(view.x, view.y, view.width, view.height);
    // a path in the drawing's units, to measure along
    const paths = travellers.map((part) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", part.dataset.travel ?? "");
      // measured only: never painted (a path is filled black by default)
      path.setAttribute("fill", "none");
      path.setAttribute("visibility", "hidden");
      figure.append(path);
      return path;
    });
    let animations: Animation[] = [];
    const start = () => {
      animations = travellers.map((part, i) =>
        part.animate(travel(part, paths[i]!, overlay, box), {
          duration: Number(part.dataset.cycle ?? 7) * 1000,
          delay: Number(part.dataset.delay ?? 0) * 1000,
          iterations: Infinity,
          fill: "backwards",
        }),
      );
    };

    // starts once the figure is well in view, as its other intros do; afterwards runs only while it shows
    const intro = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        intro.disconnect();
        start();
      },
      { rootMargin: "0px 0px -25% 0px" },
    );
    const visible = new IntersectionObserver(([entry]) => {
      for (const animation of animations) {
        if (entry?.isIntersecting) animation.play();
        else animation.pause();
      }
    });
    const resize = new ResizeObserver(() => {
      animations.forEach((animation, i) => {
        (animation.effect as KeyframeEffect).setKeyframes(
          travel(travellers[i]!, paths[i]!, overlay, box),
        );
      });
    });
    intro.observe(overlay);
    visible.observe(overlay);
    resize.observe(overlay);
    return () => {
      intro.disconnect();
      visible.disconnect();
      resize.disconnect();
      for (const animation of animations) animation.cancel();
      for (const path of paths) path.remove();
    };
  }, []);

  return (
    <>
      <span ref={ref} hidden />
      {early && <script dangerouslySetInnerHTML={{ __html: cropEarly }} suppressHydrationWarning />}
    </>
  );
}
