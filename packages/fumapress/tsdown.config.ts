import { defineConfig } from "tsdown";
import path from "node:path";
import { compilePresetCss, coreUiSource } from "../shared/compile-preset-css.ts";

export default defineConfig({
  target: "es2023",
  format: "esm",
  entry: [
    "src/{index,vite,cli,markdown,schema}.ts",
    "src/{client,image}.tsx",
    "src/router/index.tsx",
    "src/router/fs.tsx",
    "src/router/deploy.enhancer.ts",
    "src/router/client-entry.{browser,ssr}.ts",
    "src/plugins/*",
    "src/plugins/image/{cloudflare,vercel,vercel.enhancer,self-hosted}.{ts,tsx}",
  ],
  unbundle: true,
  platform: "neutral",
  dts: true,
  exports: {
    bin: false,
    exclude: ["router/client-entry.browser", "router/client-entry.ssr"],
    customExports: {
      "./css/preset.css": "./css/preset.css",
      "./css/default.css": "./css/default.css",
    },
  },
  deps: {
    onlyBundle: ["http-cache-semantics", "resolve.exports"],
    // resolved from Waku at runtime, see `wakuCompat()`
    neverBundle: [/^virtual:/, /^node:/, /^@vitejs\/plugin-rsc\//],
  },
  onSuccess: () =>
    compilePresetCss(
      { base: path.resolve("src"), pattern: "components/**/*.{ts,tsx}" },
      coreUiSource,
    ),
});
