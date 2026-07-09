import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TegamiPlugin } from "tegami";
import { renderEntryMdx } from "./render.ts";

export interface FumapressPluginOptions {
  /** Directory that accumulates published changelog MDX files. */
  dir: string;
}

export function fumapressPlugin(options: FumapressPluginOptions): TegamiPlugin {
  const { dir } = options;

  return {
    name: "fumapress",
    // after npm bumps package versions so `pkg.version` is the release version
    enforce: "post",
    async applyDraft(draft) {
      const outDir = path.resolve(this.cwd, dir);
      const date = new Date();
      const writes: Promise<void>[] = [];

      for (const entry of draft.getChangelogs()) {
        const content = renderEntryMdx(this.graph.getByName.bind(this.graph), entry, date);
        if (!content) continue;

        const filename = entry.filename.replace(/\.md$/i, ".mdx");
        writes.push(writeFile(path.join(outDir, filename), content));
      }

      if (writes.length === 0) return;
      await mkdir(outDir, { recursive: true });
      await Promise.all(writes);
    },
  };
}
