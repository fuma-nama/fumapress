import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** common subset of the Cloudflare and Netlify adapters' build options */
export interface BuildOptions {
  distDir: string;
  DIST_PUBLIC: string;
  serverless: boolean;
  FUMAPRESS_BASE_PATH: string;
  FUMAPRESS_PLATFORM: string;
}

const wranglerConfigs = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];

/**
 * Post-build step for Cloudflare and Netlify: cache hashed assets, serve pages at their slashless
 * URLs and the base path, and on Cloudflare static assets serve `404.html` for unknown URLs.
 */
export default async function buildEnhancer(
  build: (utils: unknown, options: BuildOptions) => Promise<void>,
): Promise<typeof build> {
  return async (utils, options) => {
    // Waku's enhancers generate `wrangler.jsonc` and `netlify.toml` when the project has none
    const hadWranglerConfig = wranglerConfigs.some(existsSync);
    const hadNetlifyConfig = existsSync("netlify.toml");
    await build(utils, options);
    postBuild(options, hadWranglerConfig, hadNetlifyConfig);
  };
}

function postBuild(
  { distDir, DIST_PUBLIC, serverless, FUMAPRESS_BASE_PATH, FUMAPRESS_PLATFORM }: BuildOptions,
  hadWranglerConfig: boolean,
  hadNetlifyConfig: boolean,
): void {
  const publicDir = path.join(distDir, DIST_PUBLIC);
  // Netlify has no base path option: files live at their URLs, the ones it reads by name at the root
  if (FUMAPRESS_PLATFORM === "netlify" && FUMAPRESS_BASE_PATH !== "/") {
    const baseDir = path.join(publicDir, FUMAPRESS_BASE_PATH);
    renameSync(publicDir, `${publicDir}.tmp`);
    mkdirSync(path.dirname(baseDir), { recursive: true });
    renameSync(`${publicDir}.tmp`, baseDir);
    for (const file of ["_headers", "_redirects", "404.html"]) {
      if (existsSync(path.join(baseDir, file)))
        renameSync(path.join(baseDir, file), path.join(publicDir, file));
    }
  }

  // Vite copies the project's own `public/_headers` here
  const headersFile = path.join(publicDir, "_headers");
  if (!existsSync(headersFile)) {
    writeFileSync(
      headersFile,
      `${FUMAPRESS_BASE_PATH}assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
    );
  }

  // Netlify's pretty URLs redirect `/docs` to `/docs/` for `docs/index.html`
  if (!hadNetlifyConfig && existsSync("netlify.toml")) {
    writeFileSync("netlify.toml", "[build.processing.html]\n  pretty_urls = false\n", {
      flag: "a",
    });
  }

  // the generated Wrangler configs, Waku regenerates the one of the built Worker
  const configs = [path.join(distDir, "server", "wrangler.json")];
  if (!hadWranglerConfig) configs.push("wrangler.jsonc");
  for (const file of configs) {
    if (!existsSync(file)) continue;
    const config = JSON.parse(readFileSync(file, "utf-8"));
    if (FUMAPRESS_BASE_PATH !== "/") config.assets.base_path = FUMAPRESS_BASE_PATH.slice(0, -1);
    if (!serverless) config.assets.not_found_handling = "404-page";
    writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  }
}
