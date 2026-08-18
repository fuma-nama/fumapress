#!/usr/bin/env node
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import * as vite from "vite";
import { unstable_combinedPlugins as combinedPlugins } from "waku/vite-plugins";
import type { Config } from "waku/config";
import { getDefaultAdapter, type PluginOptions } from "./vite";

const require = createRequire(import.meta.url);

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    host: {
      type: "string",
      short: "h",
    },
    port: {
      type: "string",
      short: "p",
    },
    version: {
      type: "boolean",
      short: "v",
    },
    help: {
      type: "boolean",
    },
  },
});

const cmd = positionals[0];

async function run() {
  if (values.version) {
    const { version } = require("fumapress/package.json");
    const { version: wakuVersion } = require("waku/package.json");
    console.log(`${version} (waku ${wakuVersion})`);
  } else if (values.help) {
    displayUsage();
  } else if (cmd === "dev") {
    await runDev();
  } else if (cmd === "build") {
    await runBuild();
    process.exit(0);
  } else if (cmd === "start") {
    await runStart();
  } else {
    if (cmd) {
      console.error("Unknown command:", cmd);
    }
    displayUsage();
  }
}

function displayUsage() {
  console.log(`
Usage: fumapress [options] <command>

Commands:
  dev         Start the development server
  build       Build the application for production
  start       Start the production server

Options:
  -h, --host <host>    [dev/start] Host to listen on
  -p, --port <port>    [dev/start] Port to listen on
  -v, --version        Display the version number
  --help               Display this help message
`);
}

// port of `dotenv.config({ path: ['.env.local', '.env'] })` in Waku.js without the extra dependency
function loadDotEnv() {
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  for (const [k, v] of Object.entries(vite.loadEnv(mode, process.cwd(), ""))) {
    process.env[k] ??= v;
  }
}

const configCandidates = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"];

type ResolvedConfig = Required<Omit<Config, "vite">> & Pick<Config, "vite">;

async function loadConfig(configEnv: vite.ConfigEnv): Promise<ResolvedConfig> {
  let userConfig: vite.UserConfig | undefined;

  if (configCandidates.some((file) => existsSync(file))) {
    const imported = await vite.runnerImport<{ default: vite.UserConfigExport }>("/vite.config");
    const exported = imported.module.default;
    userConfig = typeof exported === "function" ? await exported(configEnv) : await exported;
  } else if (existsSync("waku.config.ts") || existsSync("waku.config.js")) {
    throw new Error(
      "Found a waku.config file: Fumapress now reads vite.config.ts instead. Rename it to vite.config.ts, use `defineConfig` from `vite`, and move Waku.js-specific options (e.g. `basePath`) into the `press()` plugin options.",
    );
  }

  const pressOptions = await findPressOptions(userConfig?.plugins);
  return resolveConfig(pressOptions, userConfig);
}

async function findPressOptions(
  plugins: vite.PluginOption[] | undefined,
): Promise<PluginOptions | undefined> {
  for (const item of await flattenPlugins(plugins ?? [])) {
    if (item && "name" in item && item.name === "fumapress:core" && item.api?.pressOptions) {
      return item.api.pressOptions as PluginOptions;
    }
  }
}

async function flattenPlugins(plugins: vite.PluginOption[]): Promise<vite.Plugin[]> {
  const out: vite.Plugin[] = [];

  for (let item of plugins) {
    item = await item;
    if (!item) continue;

    if (Array.isArray(item)) out.push(...(await flattenPlugins(item)));
    else out.push(item as vite.Plugin);
  }

  return out;
}

function resolveConfig(
  options: PluginOptions | undefined,
  userConfig: vite.UserConfig | undefined,
): ResolvedConfig {
  const config: ResolvedConfig = {
    basePath: options?.basePath ?? "/",
    srcDir: options?.srcDir ?? "src",
    distDir: options?.distDir ?? "dist",
    privateDir: options?.privateDir ?? "private",
    rscBase: options?.rscBase ?? "RSC",
    unstable_adapter: options?.adapter ?? getDefaultAdapter(),
    vite: userConfig,
  };

  if (!config.basePath.endsWith("/")) {
    throw new Error("basePath must end with /");
  }

  return config;
}

function createServerRestartHandler(strictPort: boolean) {
  let restartInFlight = false;

  return async (host: string | undefined, port: number, server: vite.ViteDevServer) => {
    if (restartInFlight) return;
    restartInFlight = true;
    try {
      console.log("Restarting server with fresh plugin configuration...");
      const previousUrls = server.resolvedUrls;
      await server.close();
      const newServer = await startDevServer(host, port, strictPort, true);
      if (previousUrls) {
        server.resolvedUrls = newServer.resolvedUrls;
      }
    } finally {
      restartInFlight = false;
    }
  };
}

async function startDevServer(
  host: string | undefined,
  port: number,
  strictPort: boolean,
  isRestart = false,
): Promise<vite.ViteDevServer> {
  if (isRestart) loadDotEnv();
  const config = await loadConfig({ command: "serve", mode: "development" });

  const server = await vite.createServer({
    configFile: false,
    plugins: [combinedPlugins(config as Required<Config>)],
    server: { host, port, strictPort },
  });
  const handleServerRestart = createServerRestartHandler(strictPort);
  // Vite restarts itself on .env/tsconfig changes; reload our plugin configuration too
  server.restart = async () => {
    await handleServerRestart(host, port, server);
  };
  await server.listen();
  const url = server.resolvedUrls?.network?.[0] ?? server.resolvedUrls?.local?.[0];
  console.log(`ready: Listening on ${url}`);

  const watcher = server.watcher;
  async function handleConfigChange(changedFile: string) {
    if (
      path.dirname(changedFile) === process.cwd() &&
      configCandidates.includes(path.basename(changedFile))
    ) {
      console.log("Configuration file changed, restarting server...");
      await handleServerRestart(host, port, server);
    }
  }
  watcher.on("change", handleConfigChange);
  watcher.on("unlink", handleConfigChange);
  watcher.on("add", handleConfigChange);
  return server;
}

async function runDev() {
  // set NODE_ENV before vite.runnerImport: https://github.com/vitejs/vite/issues/20299
  process.env.NODE_ENV ??= "development";
  loadDotEnv();
  const configuredPort = values.port ?? process.env.PORT;
  const port = parseInt(configuredPort ?? "3000", 10);
  await startDevServer(values.host, port, configuredPort !== undefined);
}

async function runBuild() {
  process.env.NODE_ENV ??= "production";
  loadDotEnv();
  const config = await loadConfig({ command: "build", mode: "production" });

  const builder = await vite.createBuilder({
    configFile: false,
    plugins: [combinedPlugins(config as Required<Config>)],
  });
  // Waku's static-build plugin prerenders pages through this hook
  (globalThis as Record<string, unknown>).__WAKU_START_PREVIEW_SERVER__ = () =>
    startPreviewServer(config);
  await builder.buildApp();
}

async function startPreviewServer(config: ResolvedConfig) {
  const server = await vite.preview({
    configFile: false,
    plugins: [combinedPlugins(config as Required<Config>)],
  });

  return {
    baseUrl: server.resolvedUrls!.local[0],
    middlewares: {
      use: (fn: never) => server.middlewares.use(fn),
    },
    close: () => server.close(),
  };
}

async function runStart() {
  process.env.NODE_ENV ??= "production";
  loadDotEnv();
  const config = await loadConfig({ command: "serve", mode: "production" });
  const configuredPort = values.port ?? process.env.PORT;
  const port =
    configuredPort === undefined ? await getFreePort(8080) : parseInt(configuredPort, 10);

  const serveFileUrl = pathToFileURL(path.resolve(config.distDir, "serve-node.js")).href;
  if (values.host) {
    process.env.HOST = values.host;
  } else {
    delete process.env.HOST;
  }
  process.env.PORT = String(port);
  await import(serveFileUrl);
  console.log(`ready: Listening on http://${values.host || "0.0.0.0"}:${port}/`);
}

async function getFreePort(startPort: number): Promise<number> {
  for (let port = startPort; ; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const srv = net
          .createServer()
          .once("error", reject)
          .once("listening", () => srv.close(() => resolve()))
          .listen(port);
      });
      return port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw err;
      }
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
