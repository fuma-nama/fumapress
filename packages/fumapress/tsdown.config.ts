import { defineConfig } from "tsdown";
import path from "node:path";
import { compilePresetCss, coreUiSource } from "../shared/compile-preset-css.ts";

export default defineConfig({
  target: "es2023",
  format: "esm",
  entry: [
    "src/{index,vite,cli,markdown,search}.ts",
    "src/{client,image}.tsx",
    "src/router/index.tsx",
    "src/router/fs.tsx",
    "src/router/deploy.enhancer.ts",
    "src/adapters/**",
    "src/plugins/*",
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
    onlyBundle: ["http-cache-semantics", "resolve.exports"],
    neverBundle: [/^virtual:/, /^node:/],
  },
  onSuccess: () =>
    compilePresetCss(
      { base: path.resolve("src"), pattern: "components/**/*.{ts,tsx}" },
      coreUiSource,
    ),
});
