import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** common subset of the Cloudflare and Netlify adapters' build options */
export interface BuildOptions {
  distDir: string;
  DIST_PUBLIC: string;
  serverless: boolean;
  FUMAPRESS_BASE_PATH: string;
}

const wranglerConfigs = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];

/**
 * Post-build step for Cloudflare and Netlify: cache hashed assets, serve pages at their slashless
 * URLs, and on Cloudflare static assets serve the base path and `404.html` for unknown URLs.
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
  { distDir, DIST_PUBLIC, serverless, FUMAPRESS_BASE_PATH }: BuildOptions,
  hadWranglerConfig: boolean,
  hadNetlifyConfig: boolean,
): void {
  // Vite copies the project's own `public/_headers` here
  const headersFile = path.join(distDir, DIST_PUBLIC, "_headers");
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
