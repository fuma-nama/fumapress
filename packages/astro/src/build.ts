import fs from "node:fs/promises";
import path from "node:path";
import { stripBase, type PressBuildOutput } from "@fumapress/core";
import type { RuntimeContext } from "@fumapress/core/runtime";
import { matchApiRoute, serve } from "./routes/shared";

export interface BuildOutputOptions {
  /** the directory of prerendered pages and public files */
  dir: string;
  /** `outDir` of Astro, the directory of `emitFile()` */
  outDir: string;
  /** the patterns of your routes rendered on demand */
  routes: RegExp[];
}

/** a file of the build: the page at `<path>/index.html` or `<path>.html`, or the file at `path` */
async function findFile(dir: string, pathname: string): Promise<string | undefined> {
  let file: string;
  try {
    file = decodeURI(pathname).replace(/\/$/, "");
  } catch {
    return;
  }
  for (const candidate of [`${file}/index.html`, `${file}.html`, file]) {
    const target = path.join(dir, candidate);
    if ((await fs.stat(target).catch(() => undefined))?.isFile()) return target;
  }
}

/** the output of an Astro build for the `build` of plugins, routes rendered on demand answer without content */
export function createBuildOutput(
  ctx: RuntimeContext,
  links: PressBuildOutput["links"],
  { dir, outDir, routes }: BuildOutputOptions,
): PressBuildOutput {
  const base = ctx.withBase("/");

  return {
    links,
    async emitFile(file, content) {
      const target = path.join(outDir, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    },
    async fetch(request) {
      const pathname = stripBase(new URL(request.url).pathname, base);
      if (pathname === undefined) return new Response(null, { status: 404 });
      const file = await findFile(dir, pathname);
      if (file) return new Response(await fs.readFile(file));
      if (
        routes.some((route) => route.test(pathname)) ||
        (await matchApiRoute(ctx, pathname)) ||
        (await serve(ctx, request))
      )
        return new Response();
      return new Response(null, { status: 404 });
    },
  };
}
