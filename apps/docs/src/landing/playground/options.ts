/** the options of the playground, shared by the panel on the landing page and the preview in its iframe */

export type LayoutId = "docs" | "notebook";
export type TabsMode = "sidebar" | "top" | "off";
export type TocStyle = "normal" | "clerk" | "block";
export type ThemeId = "neutral" | "ocean" | "purple" | "emerald" | "ruby";

export interface PlaygroundConfig {
  /** the Fumadocs UI layout of `ui.renderPage` */
  layout: LayoutId;
  /** `site.name`, the title of the navbar */
  name: string;
  /** where the layout tabs of root folders go, `tabMode` or `tabs={false}` */
  tabs: TabsMode;
  /** `sidebar.defaultOpenLevel` */
  openLevel: 0 | 1;
  /** `tableOfContent.style` of `DocsPage` */
  toc: TocStyle;
  /** render the page buttons, the `core:markdown` and `core:view-options` slots */
  actions: boolean;
  /** the theme import of `src/app.css` */
  theme: ThemeId;
  /** `aiPlugin` of `@fumapress/ai`: the "Ask AI" action and the docked chat */
  ai: boolean;
  /** `feedbackPlugin` of `@fumapress/feedback`: the rating at the end of pages */
  feedback: boolean;
  /** `openapiPlugin` of `fumadocs-openapi`: API reference pages from an OpenAPI document */
  openapi: boolean;
  /** `blogPlugin` of `@fumapress/blog`, with a navbar link */
  blog: boolean;
  /** `changelogPlugin` of `@fumapress/tegami`, with a navbar link */
  changelog: boolean;
}

/** the switches of the plugins, in the order of the panel and of `.plugins()` */
export const features = ["ai", "feedback", "openapi", "blog", "changelog"] as const;
export type FeatureId = (typeof features)[number];

export const defaultConfig: PlaygroundConfig = {
  layout: "docs",
  name: "Acme Docs",
  tabs: "sidebar",
  openLevel: 0,
  toc: "normal",
  actions: true,
  theme: "neutral",
  ai: false,
  feedback: false,
  openapi: true,
  blog: false,
  changelog: false,
};

/** the path of the preview route, see `plugin.tsx` */
export const previewPath = "/playground-preview";

/** messages between the panel and the preview, same origin only */
export const messageType = "fumapress:playground";

export type PlaygroundMessage =
  | { type: typeof messageType; kind: "config"; config: PlaygroundConfig }
  | { type: typeof messageType; kind: "ready" };

export function isPlaygroundMessage(data: unknown): data is PlaygroundMessage {
  return (
    typeof data === "object" && data !== null && (data as { type?: unknown }).type === messageType
  );
}

export const siteName = (config: PlaygroundConfig) => config.name.trim() || defaultConfig.name;

/** `press.config.tsx` of a config */
function configCode(config: PlaygroundConfig): string {
  const pkg = `fumadocs-ui/layouts/${config.layout}`;
  const Layout = config.ai ? "ChatLayout" : "DocsLayout";
  const pageImports = ["DocsBody", "DocsDescription", "DocsPage", "DocsTitle"];

  const imports = [
    'import { createPress } from "fumapress";',
    'import { defineDocs } from "fumadocs-mdx/macro";',
  ];
  if (config.ai) imports.push('import { aiPlugin } from "@fumapress/ai";');
  if (config.feedback) imports.push('import { feedbackPlugin } from "@fumapress/feedback";');
  if (config.openapi)
    imports.push(
      'import { createOpenAPI } from "fumadocs-openapi/server";',
      'import openapiPlugin from "fumadocs-openapi/press";',
    );
  if (config.blog) imports.push('import { blogPlugin } from "@fumapress/blog";');
  if (config.changelog) imports.push('import { changelogPlugin } from "@fumapress/tegami";');
  if (!config.ai) imports.push(`import { DocsLayout } from "${pkg}";`);
  imports.push("import {", ...pageImports.map((name) => `  ${name},`), `} from "${pkg}/page";`);
  if (config.ai) imports.push('import { ChatLayout } from "./src/chat-layout";');

  const declarations = ['const docs = defineDocs({ dir: "content/docs" });'];
  if (config.blog) declarations.push('const blog = defineDocs({ dir: "content/blog" });');
  if (config.changelog)
    declarations.push('const changelog = defineDocs({ dir: "content/changelog" });');
  if (config.openapi)
    declarations.push('const openapi = createOpenAPI({ input: ["./openapi.json"] });');

  const sources = ["  docs: docs.toFumadocsSource(),"];
  if (config.openapi) sources.push("  openapi: await openapi.staticSource(),");
  if (config.blog) sources.push('  blog: blog.toFumadocsSource({ baseDir: "blog" }),');
  if (config.changelog)
    sources.push('  changelog: changelog.toFumadocsSource({ baseDir: "changelog" }),');

  const plugins: string[] = [];
  if (config.ai) plugins.push('    aiPlugin({ model: "openai/gpt-5" }),');
  if (config.feedback)
    plugins.push(
      "    feedbackPlugin({",
      "      async onPageFeedbackAction({ opinion, url, message }) {",
      '        await analytics.track("page-feedback", { opinion, url, message });',
      "        return {};",
      "      },",
      "    }),",
    );
  if (config.openapi) plugins.push("    openapiPlugin({ server: openapi }),");
  if (config.blog) plugins.push('    blogPlugin({ source: "blog" }),');
  if (config.changelog) plugins.push('    changelogPlugin({ source: "changelog" }),');

  const links: string[] = [];
  if (config.blog) links.push('          { url: "/blog", text: "Blog", active: "nested-url" },');
  if (config.changelog)
    links.push('          { url: "/changelog", text: "Changelog", active: "nested-url" },');

  const layoutProps: string[] = [];
  if (config.tabs === "off") layoutProps.push("tabs={false}");
  else if (config.tabs === "top")
    layoutProps.push(config.layout === "notebook" ? 'tabMode="navbar"' : 'tabMode="top"');
  if (config.openLevel > 0) layoutProps.push(`sidebar={{ defaultOpenLevel: ${config.openLevel} }}`);

  const layoutOpen =
    layoutProps.length === 0
      ? [`          <${Layout} {...layoutProps}>`]
      : [
          `          <${Layout}`,
          "            {...layoutProps}",
          ...layoutProps.map((prop) => `            ${prop}`),
          "          >",
        ];

  const pageOpen =
    config.toc === "normal"
      ? ["            <DocsPage toc={toc} full={pageData.full}>"]
      : [
          "            <DocsPage",
          "              toc={toc}",
          "              full={pageData.full}",
          `              tableOfContent={{ style: "${config.toc}" }}`,
          "            >",
        ];

  const props = ["layoutProps", "pageData", "toc", "body"];
  if (config.actions || config.feedback) props.push("slots");
  const types = config.openapi
    ? 'props.type !== "docs" && props.type !== "openapi"'
    : 'props.type !== "docs"';

  return [
    ...imports,
    "",
    ...declarations,
    "",
    "export default createPress({",
    ...sources,
    "})",
    ...(plugins.length > 0 ? ["  .plugins(", ...plugins, "  )"] : []),
    "  .config({",
    `    site: { name: ${JSON.stringify(siteName(config))} },`,
    "    ui: {",
    ...(links.length > 0
      ? ["      layoutProps: {", "        links: [", ...links, "        ],", "      },"]
      : []),
    "      renderPage(props) {",
    "        const { renderDefault } = props;",
    `        if (${types}) return renderDefault();`,
    `        const { ${props.join(", ")} } = props;`,
    "",
    "        return (",
    ...layoutOpen,
    ...pageOpen,
    "              <DocsTitle>{pageData.title}</DocsTitle>",
    "              <DocsDescription>{pageData.description}</DocsDescription>",
    ...(config.actions
      ? [
          '              <div className="flex gap-2">',
          '                {slots["core:markdown"]?.element}',
          '                {slots["core:view-options"]?.element}',
          "              </div>",
        ]
      : []),
    "              <DocsBody>{body}</DocsBody>",
    ...(config.feedback ? ['              {slots["feedback:page"]?.element}'] : []),
    "            </DocsPage>",
    `          </${Layout}>`,
    "        );",
    "      },",
    "    },",
    "  });",
  ].join("\n");
}

/** `src/app.css` of a config */
function cssCode(config: PlaygroundConfig): string {
  const lines = [
    '@import "tailwindcss";',
    `@import "fumadocs-ui/css/${config.theme}.css";`,
    '@import "fumadocs-ui/css/preset.css";',
    '@import "fumapress/css/preset.css";',
  ];
  if (config.ai) lines.push('@import "@fumapress/ai/css/preset.css";');
  if (config.feedback) lines.push('@import "@fumapress/feedback/css/preset.css";');
  if (config.openapi) lines.push('@import "fumadocs-openapi/css/preset.css";');
  if (config.blog) lines.push('@import "@fumapress/blog/css/preset.css";');
  if (config.changelog) lines.push('@import "@fumapress/tegami/css/preset.css";');
  return lines.join("\n");
}

/** `src/chat-layout.tsx`, the layout of `ui.renderPage` with the chat of `aiPlugin` docked through `useLayoutProps()` */
function chatLayoutCode(config: PlaygroundConfig): string {
  return [
    '"use client";',
    `import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/${config.layout}";`,
    'import { useLayoutProps } from "fumapress/client";',
    "",
    "export function ChatLayout(props: DocsLayoutProps) {",
    "  return <DocsLayout {...props} {...useLayoutProps()} />;",
    "}",
  ].join("\n");
}

/** the files of the code sheet, the layout file only with the chat */
export function codeFiles(config: PlaygroundConfig): { name: string; code: string }[] {
  const files = [
    { name: "press.config.tsx", code: configCode(config) },
    { name: "src/app.css", code: cssCode(config) },
  ];
  if (config.ai) files.push({ name: "src/chat-layout.tsx", code: chatLayoutCode(config) });
  return files;
}
