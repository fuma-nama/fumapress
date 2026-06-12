import { defineConfig } from "tsdown";
import { Scanner } from "@tailwindcss/oxide";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { packageTranslationsPlugin } from "../shared/compile-package-translations.ts";

export default defineConfig({
  target: "es2023",
  format: "esm",
  ignoreWatch: ["src/.translations/**"],
  plugins: [packageTranslationsPlugin()],
  entry: ["src/index.tsx", "src/i18n.ts", "src/schema.ts", "src/github.ts", "src/email.ts"],
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
    await compileInline();
  },
});

async function compileInline() {
  const scanner = new Scanner({
    sources: [
      {
        base: path.resolve("src"),
        pattern: "{components,layouts}/**/*.{ts,tsx}",
        negated: false,
      },
    ],
  });

  await writeFile("css/generated.css", namesToFile(scanner.scan()));

  console.log("generated CSS files");
}

function namesToFile(names: string[]) {
  return `@source inline(${JSON.stringify(names.join(" "))});`;
}
