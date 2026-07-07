import type { MintlifyDocsJson } from "@/schema";

export const minimalDocs: MintlifyDocsJson = {
  theme: "mint",
  name: "Example Docs",
  colors: { primary: "#000000" },
  navigation: {
    pages: ["getting-started", "guides/setup"],
  },
};

export const multilingualDocs: MintlifyDocsJson = {
  theme: "mint",
  name: "Multilingual Docs",
  colors: { primary: "#000000" },
  navigation: {
    languages: [
      {
        language: "en",
        default: true,
        pages: ["getting-started"],
      },
      {
        language: "zh-Hans",
        pages: ["getting-started-cn"],
      },
    ],
  },
};

export const openapiDocs: MintlifyDocsJson = {
  theme: "mint",
  name: "API Docs",
  colors: { primary: "#000000" },
  navigation: { pages: ["overview"] },
  api: {
    openapi: [
      { source: "openapi/petstore.yaml", directory: "api-reference" },
      "openapi/legacy.json",
    ],
    asyncapi: "asyncapi/events.yaml",
    playground: { proxy: false },
    url: "full",
  },
};

/** exercises the full docs.json surface */
export const fullDocs: MintlifyDocsJson = {
  $schema: "https://mintlify.com/docs.json",
  theme: "maple",
  name: "Full Docs",
  description: "A docs site",
  colors: { primary: "#16A34A", light: "#4ADE80", dark: "#15803D" },
  logo: { light: "/logo/light.svg", dark: "/logo/dark.svg", href: "https://example.com" },
  favicon: { light: "/favicon.png", dark: "/favicon-dark.png" },
  appearance: { default: "dark", strict: true },
  background: {
    image: "/bg.png",
    decoration: "gradient",
    color: { light: "#ffffff", dark: "#000000" },
  },
  navbar: {
    links: [
      { label: "Support", href: "mailto:hi@example.com", icon: "mail" },
      { type: "github", href: "https://github.com/example/repo" },
    ],
    primary: { type: "button", label: "Dashboard", href: "https://app.example.com" },
  },
  navigation: {
    tabs: [
      {
        tab: "Docs",
        icon: "book",
        groups: [
          {
            group: "Getting Started",
            tag: "NEW",
            expanded: true,
            pages: ["index", "quickstart"],
          },
        ],
      },
    ],
    global: {
      anchors: [{ anchor: "Community", href: "https://discord.gg/example", icon: "discord" }],
    },
  },
  footer: {
    socials: { x: "https://x.com/example", github: "https://github.com/example" },
    links: [
      {
        header: "Resources",
        items: [{ label: "Blog", href: "https://example.com/blog" }],
      },
    ],
  },
  banner: {
    content: "Check the [changelog](https://example.com/changelog)",
    dismissible: true,
    type: "info",
  },
  redirects: [{ source: "/old/:slug*", destination: "/new/:slug*", permanent: false }],
  fonts: { heading: { family: "Playfair Display" }, body: { family: "Inter", weight: 450 } },
  icons: { library: "lucide" },
  search: { prompt: "Search the docs..." },
  seo: { metatags: { "og:site_name": "Full Docs" }, indexing: "navigable" },
  errors: { 404: { redirect: false, title: "Not found", description: "Try **searching**." } },
  metadata: { timestamp: true },
  integrations: {
    ga4: { measurementId: "G-XXXX" },
    plausible: { domain: "example.com" },
  },
  styling: { eyebrows: "breadcrumbs", codeblocks: "dark" },
  interaction: { drilldown: false },
  variables: { version: "1.0.0" },
  markdown: { schema: true, instructions: "Prefer the CLI." },
};
