import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decoded = vi.hoisted(() => vi.fn(async () => "lists"));
vi.mock("@vitejs/plugin-rsc/ssr", () => ({ createFromReadableStream: decoded }));

async function load() {
  vi.resetModules();
  globalThis.__vite_rsc_client_require__ = (id) => `client:${id}`;
  await import("@/router/client-entry");
  return globalThis.__vite_rsc_client_require__;
}

describe("page tree modules", () => {
  beforeEach(() => {
    decoded.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    globalThis.PAGE_TREE_FILES = undefined;
  });

  it("leaves other client modules to plugin-rsc", async () => {
    const require = await load();
    expect(require("/src/a.tsx")).toBe("client:/src/a.tsx");
  });

  it("decodes a file once on the server, and forgets the ones it dropped", async () => {
    const bytes = new Uint8Array();
    globalThis.PAGE_TREE_FILES = new Map([
      ["/a.txt", bytes],
      ["/b.txt", bytes],
    ]);
    const require = await load();
    await require("page-tree:/a.txt$$cache=x");
    await require("page-tree:/a.txt");
    expect(decoded).toHaveBeenCalledTimes(1);

    globalThis.PAGE_TREE_FILES.delete("/a.txt");
    await require("page-tree:/b.txt");
    globalThis.PAGE_TREE_FILES.set("/a.txt", bytes);
    await require("page-tree:/a.txt");
    expect(decoded).toHaveBeenCalledTimes(3);
  });

  it("recovers from the 404 of a stale client like from a failed client chunk", async () => {
    vi.stubEnv("SSR", false);
    const window = new EventTarget();
    const recovery = vi.fn();
    window.addEventListener("vite:preloadError", recovery);
    vi.stubGlobal("window", window);
    vi.stubGlobal("location", { pathname: "/docs" });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));

    const require = await load();
    await expect(require("page-tree:/old.txt")).rejects.toThrow("failed to fetch the page tree");
    expect(recovery).toHaveBeenCalledOnce();
    expect((recovery.mock.calls[0]![0] as Event).cancelable).toBe(true);
  });
});
