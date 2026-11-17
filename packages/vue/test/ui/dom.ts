import { vi } from "vitest";

/**
 * The browser APIs jsdom lacks, which the UI calls once mounted: no-ops, so a test sees what the UI does, not what
 * jsdom doesn't implement (jsdom reports `scrollTo` as an error).
 */
export function stubBrowser() {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal("scrollTo", () => {});
  Element.prototype.scrollIntoView ??= () => {};
}

/** the arguments of a console call, as one line */
export function format(args: unknown[]): string {
  return args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(" ");
}
