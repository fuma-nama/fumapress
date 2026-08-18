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
  entry: [
    "src/{index,vite,i18n,cli}.ts",
    "src/{client,image}.tsx",
    "src/router/index.tsx",
    "src/router/fs.tsx",
    "src/adapters/**",
    "src/{layouts,plugins}/*",
    "!src/plugins/*.client.tsx",
    "src/plugins/image/{cloudflare,vercel,vercel.enhancer,self-hosted}.{ts,tsx}",
  ],
  unbundle: true,
  platform: "neutral",
  dts: true,
  exports: {
    bin: false,
    customExports: {
      "./css/preset.css": "./css/preset.css",
      "./css/default.css": "./css/default.css",
    },
  },
  deps: {
    onlyBundle: ["@fastify/deepmerge", "http-cache-semantics", "resolve.exports"],
    neverBundle: [/^virtual:/, /^node:/],
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
