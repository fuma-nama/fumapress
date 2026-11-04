import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Scanner, type GlobEntry } from "@tailwindcss/oxide";

/** the built-in UI of `@fumapress/core`, which both runtimes render */
export const coreUiSource: GlobEntry = {
  base: path.join(import.meta.dirname, "../core/src/runtime"),
  pattern: "ui.tsx",
};

/** the Tailwind classes of the files matching `sources`, as `css/generated.css` for the package's preset */
export async function compilePresetCss(...sources: GlobEntry[]): Promise<void> {
  const scanner = new Scanner({
    sources: sources.map((source) => ({ ...source, negated: false })),
  });
  const names = scanner.scan().toSorted().join(" ");
  await writeFile("css/generated.css", `@source inline(${JSON.stringify(names)});\n`);
  console.log("generated CSS files");
}
