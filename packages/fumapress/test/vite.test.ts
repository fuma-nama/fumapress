import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { Plugin } from "vite";
import press from "@/vite";

const wakuPkg = realpathSync(fileURLToPath(import.meta.resolve("waku/package.json")));
const wakuRsc = path.dirname(
  realpathSync(createRequire(wakuPkg).resolve("@vitejs/plugin-rsc/package.json")),
);
const importer = fileURLToPath(new URL("../src/router/client-entry.ts", import.meta.url));

function resolveRsc(mode: "dev" | "build", source: string, from: string | undefined) {
  const plugin = press().find((item): item is Plugin => item.name === "fumapress:plugin-rsc")!;
  const hook = plugin.resolveId as { handler: (...args: unknown[]) => unknown };
  const resolve = vi.fn(async () => ({ id: "resolved" }));
  const ctx = { environment: { mode, config: { resolve: { conditions: [] } } }, resolve };
  return { result: hook.handler.call(ctx, source, from, {}), resolve };
}

describe("@vitejs/plugin-rsc", () => {
  it("resolves the copy of Waku in builds", () => {
    const { result, resolve } = resolveRsc("build", "@vitejs/plugin-rsc/browser", importer);
    expect(result).toBe(path.join(wakuRsc, "dist/browser.js"));
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolves from Waku through Vite in dev", () => {
    const { resolve } = resolveRsc("dev", "@vitejs/plugin-rsc/ssr", importer);
    expect(resolve).toHaveBeenCalledWith("@vitejs/plugin-rsc/ssr", wakuPkg, { skipSelf: true });
  });

  it("leaves the imports of plugin-rsc itself", () => {
    const from = path.join(wakuRsc, "dist/index.js");
    expect(resolveRsc("build", "@vitejs/plugin-rsc/rsc", from).result).toBeUndefined();
  });
});
