import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** a React Flight error row, e.g. `1:E{"digest":""}` */
const errorRow = /^[0-9a-f]+:E\{/m;

/**
 * Fails when a prerendered RSC payload contains an error row: React serializes errors thrown
 * by server components into the payload instead of failing the render, so a static build would
 * otherwise ship them as blank pages.
 *
 * @param rscDir directory of the emitted payloads, e.g. `dist/public/RSC`
 */
export async function assertNoPrerenderErrors(rscDir: string): Promise<void> {
  let files: string[];
  try {
    files = await readdir(rscDir, { recursive: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }

  const routes: string[] = [];
  for (const file of files) {
    if (file.endsWith(".txt") && errorRow.test(await readFile(path.join(rscDir, file), "utf-8")))
      routes.push(toRoute(file));
  }

  if (routes.length > 0) {
    throw new Error(
      `A server component threw while prerendering these pages, see the error above for the cause:\n${routes.join("\n")}`,
    );
  }
}

/** `R/docs/foo.txt` -> `/docs/foo`, see `encodeRoutePath` and `encodeRscPath` in Waku */
function toRoute(file: string): string {
  const rscPath = file.slice(0, -".txt".length).replaceAll(path.sep, "/");
  if (rscPath === "R/_root") return "/";
  return rscPath.startsWith("R/") ? rscPath.slice(1) : rscPath;
}
