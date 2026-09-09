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
 * Post-build step for Cloudflare and Netlify: cache hashed assets, and serve `404.html` for unknown URLs on Cloudflare static assets.
 */
export default async function buildEnhancer(
  build: (utils: unknown, options: BuildOptions) => Promise<void>,
): Promise<typeof build> {
  return async (utils, options) => {
    // Waku's Cloudflare enhancer generates `wrangler.jsonc` when the project has no Wrangler config
    const hadWranglerConfig = wranglerConfigs.some(existsSync);
    await build(utils, options);
    postBuild(options, hadWranglerConfig);
  };
}

function postBuild(
  { distDir, DIST_PUBLIC, serverless, FUMAPRESS_BASE_PATH }: BuildOptions,
  hadWranglerConfig: boolean,
): void {
  // Vite copies the project's own `public/_headers` here
  const headersFile = path.join(distDir, DIST_PUBLIC, "_headers");
  if (!existsSync(headersFile)) {
    writeFileSync(
      headersFile,
      `${FUMAPRESS_BASE_PATH}assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
    );
  }

  if (serverless || hadWranglerConfig || !existsSync("wrangler.jsonc")) return;
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf-8"));
  config.assets.not_found_handling = "404-page";
  writeFileSync("wrangler.jsonc", JSON.stringify(config, null, 2) + "\n");
}
