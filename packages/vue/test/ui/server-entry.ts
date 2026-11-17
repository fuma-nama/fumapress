// Loaded with `ssrLoadModule()` by `render-layouts.ts`: the `.vue` files are compiled for the server, as on a site.
import { renderToString } from "vue/server-renderer";
import { createTestApp, layouts, type LayoutName } from "./app";

export const names = Object.keys(layouts) as LayoutName[];

export async function render(layout: LayoutName): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const { app } = await createTestApp(layout);
  app.config.warnHandler = (message) => void warnings.push(message);
  const html = await renderToString(app);
  return { html, warnings };
}
