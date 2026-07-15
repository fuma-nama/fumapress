import { Scanner } from "@tailwindcss/oxide";
import { defineConfig } from "tsdown";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export default defineConfig({
  entry: ["src/index.ts", "src/source.ts", "src/renderer.tsx"],
  target: "es2023",
  format: "esm",
  dts: {
    sourcemap: false,
  },
  unbundle: true,
  exports: {
    customExports: {
      "./css/preset.css": "./css/preset.css",
    },
  },
  deps: {
    onlyBundle: [],
  },
  async onSuccess() {
    const scanner = new Scanner({
      sources: [{ base: path.resolve("src"), pattern: "**/*.{ts,tsx}", negated: false }],
    });

    const candidates = scanner.scan().toSorted();
    await writeFile(
      "css/generated.css",
      `@source inline(${JSON.stringify(candidates.join(" "))});\n`,
    );
    console.log("generated CSS source");
  },
});
