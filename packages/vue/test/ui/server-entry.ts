// Loaded with `ssrLoadModule()` by `render-layouts.ts`: the `.vue` files are compiled for the server, as on a site.
import { renderToString, type SSRContext } from "vue/server-renderer";
import { cases, createTestApp, type CaseName } from "./app";

export const names = Object.keys(cases) as CaseName[];

export async function render(
  name: CaseName,
): Promise<{ html: string; warnings: string[]; modules: string[] }> {
  const warnings: string[] = [];
  const { app } = await createTestApp(name);
  app.config.warnHandler = (message) => void warnings.push(message);
  // the `.vue` files the render used, which the server of a site links from the document
  const context: SSRContext = {};
  const html = await renderToString(app, context);
  return { html, warnings, modules: [...(context.modules ?? [])] };
}
