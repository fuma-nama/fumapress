// The server half of `ui-layouts.test.ts`, a global setup of its project.
//
// A layout must render the same HTML on the server and in the browser, so the test hydrates what the server rendered.
// The server render has to run where a server runs: without `window` and `document`, so code that reads them while
// rendering takes the server branch and a mismatch shows. A jsdom test can't give that, as jsdom is global in its
// worker and libraries read it once when they load (`isClient` of VueUse). So the layouts are rendered here, in the
// main process of Vitest, with the `.vue` files compiled for the server by Vite's `ssrLoadModule()`, and the HTML
// reaches the test with `provide()`. Nothing is written to disk.
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import type { TestProject } from "vitest/node";
import type { LayoutName } from "./app";

export interface ServerRender {
  html: string;
  /** Vue warnings and `console.warn`/`console.error` calls while rendering */
  warnings: string[];
  /** what the render threw, so one broken layout doesn't stop the tests of the others */
  error?: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    layouts: Record<LayoutName, ServerRender>;
  }
}

export default async function setup(project: TestProject) {
  const server = await createServer({
    configFile: fileURLToPath(new URL("../../vitest.config.ts", import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    logLevel: "silent",
  });

  const { warn, error } = console;
  try {
    const entry = (await server.ssrLoadModule(
      "/test/ui/server-entry.ts",
    )) as typeof import("./server-entry");
    const results = {} as Record<LayoutName, ServerRender>;
    for (const name of entry.names) {
      const logged: string[] = [];
      console.warn = console.error = (...args: unknown[]) =>
        void logged.push(args.map(String).join(" "));
      try {
        const { html, warnings } = await entry.render(name);
        results[name] = { html, warnings: [...warnings, ...logged] };
      } catch (error) {
        results[name] = { html: "", warnings: logged, error: String((error as Error).stack) };
      }
    }
    project.provide("layouts", results);
  } finally {
    console.warn = warn;
    console.error = error;
    await server.close();
  }
}
