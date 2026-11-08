import { afterEach, expect, it, vi } from "vitest";

vi.mock("@vitejs/plugin-rsc/browser", () => ({ createFromFetch: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("recovers from the 404 of a stale client like from a failed client chunk", async () => {
  vi.stubEnv("SSR", false);
  const window = new EventTarget();
  const recovery = vi.fn();
  window.addEventListener("vite:preloadError", recovery);
  vi.stubGlobal("window", window);
  vi.stubGlobal("location", { pathname: "/docs" });
  vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));

  globalThis.__vite_rsc_client_require__ = (id) => `client:${id}`;
  await import("@/router/client-entry.browser");
  const require = globalThis.__vite_rsc_client_require__;

  await expect(require("page-tree:/old.txt")).rejects.toThrow("failed to fetch the page tree");
  expect(recovery).toHaveBeenCalledOnce();
  expect((recovery.mock.calls[0]![0] as Event).cancelable).toBe(true);
});
