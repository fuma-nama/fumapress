import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { crawlFrameworkPkgs } from "@/runtime/vite";

// realpath: the crawl resolves symlinks, and macOS keeps its temp dir behind one
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fumapress-vitefu-")));

afterAll(() => fs.rm(root, { recursive: true, force: true }));

function crawl(dir: string) {
  return crawlFrameworkPkgs(dir, "waku");
}

async function writePkg(dir: string, pkgJson: object) {
  const target = path.join(root, dir);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), JSON.stringify(pkgJson));
}

await writePkg(".", {
  name: "app",
  dependencies: { "fumadocs-fixture": "*", react: "*" },
});
await writePkg("node_modules/react", { name: "react", main: "index.js" });
await writePkg("node_modules/fumadocs-fixture", {
  name: "fumadocs-fixture",
  type: "module",
  exports: { ".": "./index.js" },
  dependencies: { "mdx-lib": "*", "cjs-lib": "*", "mixed-lib": "*", "shared-lib": "*" },
});
// ESM intermediate carrying a declaration-only dependency, like `@mdx-js/mdx` > `@types/mdx`.
// It also reaches `shared-lib` and `cjs-lib` again, and forms a cycle with `cycle-lib`
await writePkg("node_modules/mdx-lib", {
  name: "mdx-lib",
  type: "module",
  exports: { ".": "./index.js" },
  dependencies: { "@types/mdx": "*", "shared-lib": "*", "cjs-lib": "*", "cycle-lib": "*" },
});
await writePkg("node_modules/cycle-lib", {
  name: "cycle-lib",
  type: "module",
  exports: { ".": "./index.js" },
  dependencies: { "mdx-lib": "*", "shared-lib": "*" },
});
await writePkg("node_modules/@types/mdx", {
  name: "@types/mdx",
  main: "",
  types: "index.d.ts",
  exports: {
    ".": "./index.d.ts",
    "./types": "./types.d.ts",
    "./types.js": "./types.d.ts",
    "./package.json": "./package.json",
  },
});
// CJS with an export map, like `use-sync-external-store`
await writePkg("node_modules/cjs-lib", {
  name: "cjs-lib",
  exports: {
    ".": "./index.js",
    "./shim": {
      "react-native": "./shim/index.native.js",
      default: "./shim/index.js",
    },
    "./shim/index.js": "./shim/index.js",
    "./package.json": "./package.json",
  },
});
// CJS whose `./types` subpath resolves to a declaration file
await writePkg("node_modules/mixed-lib", {
  name: "mixed-lib",
  exports: {
    ".": { require: "./index.cjs", types: "./index.d.ts" },
    "./types": "./types.d.ts",
  },
});
// CJS reachable through several chains of different lengths
await writePkg("node_modules/shared-lib", {
  name: "shared-lib",
  main: "index.js",
});

test("pre-bundles CJS runtime entries only, never declaration files", async () => {
  expect(await crawl(root)).toEqual({
    framework: ["fumadocs-fixture"],
    include: [
      "fumadocs-fixture > cjs-lib",
      "fumadocs-fixture > cjs-lib/shim",
      "fumadocs-fixture > mixed-lib",
      "fumadocs-fixture > shared-lib",
    ],
  });
});
