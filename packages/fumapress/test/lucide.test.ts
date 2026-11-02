import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { createServer, parseSync } from "vite";
import { getBarrelExports, lucideImports, rewriteImports } from "@/lib/lucide";

const dir = "/app/node_modules/lucide-react/dist/esm";

// the shape of `lucide-react/dist/esm/lucide-react.mjs`
const barrel = `"use strict";
import * as index from './icons/index.mjs';
export { index as icons };
export { default as ChevronDown, default as ChevronDownIcon } from './icons/chevron-down.mjs';
export { default as X } from './icons/x.mjs';
export { LucideProvider, useLucideContext } from './context.mjs';
`;

const exports = getBarrelExports(`${dir}/lucide-react.mjs`, barrel);

function rewrite(code: string) {
  const imports = parseSync("app.js", code).module.staticImports.filter(
    (statement) => statement.moduleRequest.value === "lucide-react",
  );
  return rewriteImports(code, imports, exports);
}

test("maps re-exported names to the modules declaring them", () => {
  expect(Object.fromEntries(exports)).toEqual({
    ChevronDown: { file: `${dir}/icons/chevron-down.mjs`, name: "default" },
    ChevronDownIcon: { file: `${dir}/icons/chevron-down.mjs`, name: "default" },
    X: { file: `${dir}/icons/x.mjs`, name: "default" },
    LucideProvider: { file: `${dir}/context.mjs`, name: "LucideProvider" },
    useLucideContext: { file: `${dir}/context.mjs`, name: "useLucideContext" },
  });
});

test("rewrites named imports into imports of the declaring modules", () => {
  expect(
    rewrite(`import { ChevronDown as Chevron, X } from "lucide-react";
import { LucideProvider } from 'lucide-react';
export { Chevron, X, LucideProvider };`),
  ).toBe(`import Chevron from "${dir}/icons/chevron-down.mjs"; import X from "${dir}/icons/x.mjs";
import { LucideProvider as LucideProvider } from "${dir}/context.mjs";
export { Chevron, X, LucideProvider };`);
});

test("keeps the line numbers of multi-line imports", () => {
  const code = `import {
  ChevronDown,
  X,
} from "lucide-react";
console.log(ChevronDown, X);`;

  expect(rewrite(code)?.split("\n")).toEqual([
    `import ChevronDown from "${dir}/icons/chevron-down.mjs"; import X from "${dir}/icons/x.mjs";`,
    "",
    "",
    "",
    "console.log(ChevronDown, X);",
  ]);
});

test("keeps imports binding anything else", () => {
  for (const code of [
    `import { icons } from "lucide-react";`,
    `import * as Lucide from "lucide-react";`,
    `import { X, Unknown } from "lucide-react";`,
    `import "lucide-react";`,
  ]) {
    expect(rewrite(code)).toBeUndefined();
  }
});

// realpath: Vite resolves symlinks, and macOS keeps its temp dir behind one
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fumapress-lucide-")));
afterAll(() => fs.rm(root, { recursive: true, force: true }));

async function writeFile(file: string, content: string) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), content);
}

test("imports the declaring modules in the dev server", async () => {
  const esm = "node_modules/lucide-react/dist/esm";
  await writeFile(
    "node_modules/lucide-react/package.json",
    JSON.stringify({ name: "lucide-react", module: "dist/esm/lucide-react.mjs" }),
  );
  await writeFile(`${esm}/lucide-react.mjs`, barrel);
  await writeFile(`${esm}/icons/index.mjs`, "export {};");
  await writeFile(`${esm}/icons/chevron-down.mjs`, "export default 'chevron-down';");
  await writeFile(`${esm}/icons/x.mjs`, "export default 'x';");
  await writeFile(`${esm}/context.mjs`, "export const LucideProvider = 0, useLucideContext = 0;");
  await writeFile("package.json", JSON.stringify({ name: "app", type: "module" }));
  await writeFile(
    "src/app.js",
    `import { ChevronDown as Chevron, X, LucideProvider } from "lucide-react";
export { Chevron, X, LucideProvider };`,
  );

  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [lucideImports()],
  });

  try {
    const result = await server.environments.client.transformRequest("/src/app.js");
    const code = result?.code.replaceAll(/\?v=\w+/g, "");

    expect(code).toContain(`import Chevron from "/${esm}/icons/chevron-down.mjs";`);
    expect(code).toContain(`import X from "/${esm}/icons/x.mjs";`);
    expect(code).toContain(
      `import { LucideProvider as LucideProvider } from "/${esm}/context.mjs";`,
    );
    expect(code).not.toContain("lucide-react.mjs");
    expect(server.environments.client.config.optimizeDeps.exclude).toContain("lucide-react");
  } finally {
    await server.close();
  }
});
