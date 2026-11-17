// @vitest-environment jsdom
// Every layout renders on the server and hydrates in the browser without a warning: a mismatch makes Vue throw away
// the DOM of the server, and a warning is a bug of the port. The server half is `ui/render-layouts.ts`, which explains
// why it runs apart from this file.
import { afterEach, expect, inject, test, vi } from "vitest";
import { nextTick } from "vue";
import { PAGE_URL, VIEW_URL, createTestApp, type CaseName } from "./ui/app";
import { format, stubBrowser } from "./ui/dom";

stubBrowser();
const rendered = inject("layouts");
const names = Object.keys(rendered) as CaseName[];
const layouts = ["docs", "notebook", "glass", "spacious", "flux"] as const;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

/** hydrates the HTML of the server, and returns the warnings of Vue and the console */
async function hydrate(name: CaseName, html: string) {
  const issues: string[] = [];
  const record = (...args: unknown[]) => void issues.push(format(args));
  vi.spyOn(console, "warn").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const title = container.querySelector("h1");
  const { app } = await createTestApp(name);
  app.config.warnHandler = (message) => void issues.push(message);
  app.config.errorHandler = (error) => void issues.push(format([error]));
  app.mount(container);
  cleanups.push(() => {
    app.unmount();
    container.remove();
  });

  // async components, like the search dialog, hydrate once loaded, and effects of `onMounted` run after a tick
  await vi.dynamicImportSettled();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
  // hydrated, not rendered again: the elements of the server are kept, so the page doesn't flash
  expect(title).not.toBeNull();
  expect(container.querySelector("h1")).toBe(title);
  return { issues, container };
}

test("the server renders every case", () => {
  expect([...names].sort()).toEqual([
    "docs",
    "flux",
    "glass",
    "home",
    "notebook",
    "spacious",
    "theme",
  ]);
});

test.each(layouts)(
  "the theme of the %s layout renders the page on the server and hydrates without a warning",
  async (name) => {
    const { html, warnings, error, modules } = rendered[name];
    expect(error).toBeUndefined();
    expect(warnings).toEqual([]);
    // the page, its table of contents, the page tree with both kinds of icons, and the links of the layout
    expect(html).toContain("Change the colors of the site.");
    expect(html).toContain("Dark mode");
    expect(html).toContain("Install");
    expect(html).toContain("📦");
    expect(html).toContain("lucide-languages");
    expect(html).toContain('href="https://github.com/fuma-nama/fumapress"');

    // the theme imports its layout only: the server renders no other one
    const wrappers = modules.filter((id) => id.startsWith("theme/layouts/"));
    expect(wrappers).toEqual([`theme/layouts/${name[0]!.toUpperCase()}${name.slice(1)}.vue`]);
    expect(modules.some((id) => id.startsWith(`ui/layouts/${name}/`))).toBe(true);
    for (const other of layouts.filter((each) => each !== name)) {
      expect(modules.some((id) => id.startsWith(`ui/layouts/${other}/`))).toBe(false);
    }

    const { issues } = await hydrate(name, html);
    expect(issues).toEqual([]);
  },
);

test("a view of the theme wraps a layout with options over the config's", async () => {
  const { html, warnings, error } = rendered.theme;
  expect(error).toBeUndefined();
  expect(warnings).toEqual([]);
  expect(html).toContain('id="nd-notebook-layout"');
  expect(html).not.toContain('id="nd-docs-layout"');
  expect(html).toContain("Change the colors of the site.");
  // the props of the theme win over those of the config, which still give the rest
  expect(html).toContain("From the theme");
  expect(html).toContain('href="https://github.com/fuma-nama/fumapress"');

  const { issues } = await hydrate("theme", html);
  expect(issues).toEqual([]);
});

test("the home layout renders on the server and hydrates without a warning", async () => {
  const { html, warnings, error } = rendered.home;
  expect(error).toBeUndefined();
  expect(warnings).toEqual([]);
  expect(html).toContain("<h1>Press</h1>");
  expect(html).toContain("Blog");

  const { issues } = await hydrate("home", html);
  expect(issues).toEqual([]);
});

test("a navigation from a view shows the content page in its layout at once", async () => {
  // the app starts on a view, which renders no layout of the content
  const { app, router } = await createTestApp("spacious", VIEW_URL);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.append(container);
  app.mount(container);
  cleanups.push(() => {
    app.unmount();
    container.remove();
  });
  expect(container.querySelector("h1")?.textContent).toBe("Press");

  await router.push(PAGE_URL);
  await nextTick();
  // the layout is on screen when the route changes, not after its code loads
  expect(container.querySelector("h1")?.textContent).toBe("Theme");
  expect(container.innerHTML).toContain("Change the colors of the site.");
});

test("a mismatch between the server and the browser is reported", async () => {
  // the harness would pass any layout if hydration never compared: corrupt a text and an attribute of the server
  const html = rendered.docs.html
    .replace(">Change the colors of the site.<", ">Something else.<")
    .replace('href="https://github.com/fuma-nama/fumapress"', 'href="https://example.com"');
  expect(html).not.toBe(rendered.docs.html);

  const { issues } = await hydrate("docs", html);
  expect(issues.join("\n")).toMatch(/Hydration text mismatch/);
  expect(issues.join("\n")).toMatch(/Hydration attribute mismatch/);
});
