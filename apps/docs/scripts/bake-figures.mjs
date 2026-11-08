// Bakes the figure files of the landing into AVIF images, drawn by Chrome so they match the page exactly.
//
// The SVG files carry brush filters, which the browser rasterizes the first time a figure comes into view: about a
// second of GPU work for the larger figures, and blank tiles while it runs. A baked image only decodes. The page uses a
// baked image when one matches the current drawing (the hash in its name) and the SVG file otherwise, so a stale bake
// is never shown: run this again after changing a figure.
//
// usage: pnpm build && pnpm bake  (needs Google Chrome)
import sharp from "sharp";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "dist/public/_figures");
const out = join(root, "src/landing/baked");
// screens of up to 2x density; AVIF at this quality keeps the grain of the brush
const scale = 2;
const quality = 60;
// the hero is embedded in the page as SVG, so it shows with the first paint
const skip = /^hero-/;
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!existsSync(source)) throw new Error(`no figures in ${source}, run \`pnpm build\` first`);
mkdirSync(out, { recursive: true });

const port = 9700 + Math.floor(Math.random() * 200);
const browser = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "bake-"))}`,
  "--headless=new",
  "--no-first-run",
  "--hide-scrollbars",
  "about:blank",
]);
browser.stderr.on("data", () => {});
/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let url = "";
for (let i = 0; i < 100 && !url; i++) {
  await sleep(100);
  try {
    /** @type {{ type: string; webSocketDebuggerUrl: string }[]} */
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    url = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? "";
  } catch {}
}
const ws = new WebSocket(url);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let id = 0;
/** @type {Map<number, (msg: any) => void>} */
const pending = new Map();
/** @type {Set<(msg: any) => void>} */
const listeners = new Set();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.id) pending.get(msg.id)?.(msg);
  else for (const listener of listeners) listener(msg);
});

/**
 * A command of the DevTools protocol.
 * @param {string} method
 * @param {object} [params]
 * @returns {Promise<any>}
 */
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, (msg) =>
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result),
    );
    ws.send(JSON.stringify({ id: i, method, params }));
  });

/**
 * Resolves on the next event of the DevTools protocol named `method`.
 * @param {string} method
 * @returns {Promise<void>}
 */
const next = (method) =>
  new Promise((resolve) => {
    /** @param {any} msg */
    const listener = (msg) => {
      if (msg.method !== method) return;
      listeners.delete(listener);
      resolve();
    };
    listeners.add(listener);
  });

await send("Page.enable");
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

const files = readdirSync(source).filter((f) => f.endsWith(".svg") && !skip.test(f));
const kept = new Set();
for (const file of files) {
  const svg = readFileSync(join(source, file), "utf8");
  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1]);
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1]);
  const name = file.replace(/\.svg$/, ".avif");
  kept.add(name);
  if (existsSync(join(out, name))) continue;
  await send("Emulation.setDeviceMetricsOverride", {
    width: Math.ceil(width),
    height: Math.ceil(height),
    deviceScaleFactor: scale,
    mobile: false,
  });
  const loaded = next("Page.loadEventFired");
  await send("Page.navigate", { url: pathToFileURL(join(source, file)).href });
  await loaded;
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  const image = await sharp(Buffer.from(shot.data, "base64"))
    .avif({ quality, effort: 6, chromaSubsampling: "4:4:4" })
    .toBuffer();
  writeFileSync(join(out, name), image);
  console.log(name);
}

// bakes of drawings that changed since
for (const file of readdirSync(out))
  if (file.endsWith(".avif") && !kept.has(file)) rmSync(join(out, file));

ws.close();
browser.kill();
