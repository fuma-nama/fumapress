import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import buildEnhancer, { type BuildOptions } from "@/router/deploy.enhancer";

const cwd = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fumapress-deploy-"));
  mkdirSync(join(dir, "dist/public"), { recursive: true });
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const generated = {
  name: "app",
  assets: { directory: "./dist/public", html_handling: "drop-trailing-slash" },
};

/** the inner build stands in for Waku's Cloudflare enhancer, which generates `wrangler.jsonc` unless the project has a Wrangler config */
async function run(options: Partial<BuildOptions> = {}, cloudflare = true) {
  const build = await buildEnhancer(async () => {
    if (cloudflare && !["wrangler.toml", "wrangler.json", "wrangler.jsonc"].some(existsSync)) {
      writeFileSync("wrangler.jsonc", JSON.stringify(generated));
    }
  });

  await build(undefined, {
    distDir: "dist",
    DIST_PUBLIC: "public",
    serverless: true,
    FUMAPRESS_BASE_PATH: "/",
    ...options,
  });
}

test("caches hashed assets under the base path", async () => {
  await run({ FUMAPRESS_BASE_PATH: "/docs/" });

  expect(readFileSync("dist/public/_headers", "utf-8")).toBe(
    "/docs/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  );
});

test("keeps the project's own _headers", async () => {
  writeFileSync("dist/public/_headers", "/*\n  X-Custom: 1\n");
  await run();

  expect(readFileSync("dist/public/_headers", "utf-8")).toBe("/*\n  X-Custom: 1\n");
});

test("serves 404.html from the generated Wrangler config in static mode", async () => {
  await run({ serverless: false });

  expect(JSON.parse(readFileSync("wrangler.jsonc", "utf-8"))).toEqual({
    ...generated,
    assets: { ...generated.assets, not_found_handling: "404-page" },
  });
});

test("leaves the generated Wrangler config alone with a worker", async () => {
  await run({ serverless: true });

  expect(JSON.parse(readFileSync("wrangler.jsonc", "utf-8"))).toEqual(generated);
});

test("leaves the project's own Wrangler config alone", async () => {
  writeFileSync("wrangler.jsonc", "// mine\n{}\n");
  await run({ serverless: false });
  expect(readFileSync("wrangler.jsonc", "utf-8")).toBe("// mine\n{}\n");

  rmSync("wrangler.jsonc");
  writeFileSync("wrangler.toml", 'name = "mine"\n');
  await run({ serverless: false });
  expect(existsSync("wrangler.jsonc")).toBe(false);
});

test("writes no Wrangler config on other platforms", async () => {
  await run({ serverless: false }, false);

  expect(existsSync("wrangler.jsonc")).toBe(false);
  expect(existsSync("dist/public/_headers")).toBe(true);
});
