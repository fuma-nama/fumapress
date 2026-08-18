"use client";

import { ShikiMagicMove } from "@shikijs/magic-move/react";
import "@shikijs/magic-move/style.css";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "./cn";
import { highlighter, magicMoveOptions } from "./home.client";

type FeatureId = "ai" | "mcp" | "openapi" | "blog";

interface Feature {
  id: FeatureId;
  name: string;
  description: string;
  imports: { from: string; names: string[] }[];
  setup?: string[];
  content?: string[];
  plugin: string;
}

const features: Feature[] = [
  {
    id: "ai",
    name: "AI Chat",
    description: 'Adds an "Ask AI" dialog that answers from your docs.',
    imports: [
      { from: "@ai-sdk/openai", names: ["openai"] },
      { from: "@fumapress/ai", names: ["aiPlugin"] },
    ],
    plugin: 'aiPlugin({ model: openai("gpt-5") })',
  },
  {
    id: "mcp",
    name: "MCP Server",
    description: "Exposes your docs to AI agents over Model Context Protocol.",
    imports: [{ from: "@fumapress/ai", names: ["mcpPlugin"] }],
    plugin: "mcpPlugin()",
  },
  {
    id: "openapi",
    name: "OpenAPI",
    description: "Generates API reference pages from your OpenAPI spec.",
    imports: [
      { from: "fumadocs-openapi/server", names: ["createOpenAPI"] },
      { from: "fumapress/plugins/openapi", names: ["openapiPlugin"] },
    ],
    setup: ['const openapi = createOpenAPI({ input: ["./openapi.json"] });'],
    content: ["    openapi: await openapi.staticSource(),"],
    plugin: "openapiPlugin({ server: openapi })",
  },
  {
    id: "blog",
    name: "Blog",
    description: "Turns content collections into a polished blog.",
    imports: [{ from: "fumapress/plugins/blog", names: ["blogPlugin"] }],
    setup: [
      "const blog = defineDocs({",
      '  dir: "content/blog",',
      "  docs: { async: true },",
      "});",
    ],
    content: ['    blog: blog.toFumadocsSource({ baseDir: "blog" }),'],
    plugin: "blogPlugin()",
  },
];

function createConfigCode(selected: readonly FeatureId[]) {
  const activeFeatures = features.filter((feature) => selected.includes(feature.id));

  const importsByModule = new Map<string, string[]>();
  for (const feature of activeFeatures) {
    for (const { from, names } of feature.imports) {
      const merged = importsByModule.get(from) ?? [];
      for (const name of names) if (!merged.includes(name)) merged.push(name);
      importsByModule.set(from, merged);
    }
  }

  const plugins = activeFeatures.map((feature) => feature.plugin);

  return [
    'import { defineConfig } from "fumapress";',
    'import { fumadocsMdx } from "fumapress/adapters/mdx";',
    ...Array.from(
      importsByModule,
      ([from, names]) => `import { ${names.join(", ")} } from "${from}";`,
    ),
    'import { defineDocs } from "fumadocs-mdx/macro";',
    "",
    "const docs = defineDocs({",
    '  dir: "content/docs",',
    "  docs: { async: true },",
    "});",
    ...activeFeatures.flatMap((feature) => (feature.setup ? ["", ...feature.setup] : [])),
    "",
    "export default defineConfig({",
    "  content: {",
    "    docs: docs.toFumadocsSource(),",
    ...activeFeatures.flatMap((feature) => feature.content ?? []),
    "  },",
    "})",
    ...(plugins.length === 0
      ? []
      : plugins.length === 1
        ? [`  .plugins(${plugins[0]})`]
        : ["  .plugins(", ...plugins.map((plugin) => `    ${plugin},`), "  )"]),
    "  .adapters(fumadocsMdx());",
  ].join("\n");
}

export function HomeConfigPlayground() {
  const [selected, setSelected] = useState<FeatureId[]>([]);
  const code = useMemo(() => createConfigCode(selected), [selected]);

  return (
    <section className="mx-auto grid grid-cols-1 w-full max-w-[1400px] gap-8 border-x border-b border-fd-border px-6 py-10 md:grid-cols-2 md:px-12 md:py-14">
      <div className="flex flex-col @container">
        <p className="text-sm font-medium text-fd-primary">Everything is a Plugin</p>
        <h3 className="mt-4 max-w-lg text-3xl font-medium tracking-tight md:text-4xl">
          Your config grows only when your site does.
        </h3>
        <p className="my-4 max-w-xl text-fd-muted-foreground">
          Toggle features to see how Fumapress adds capability through plugins without reshaping the
          rest of your app.
        </p>

        <div className="grid gap-3 mt-auto grid-cols-1 @md:grid-cols-2">
          {features.map((feature) => {
            const isSelected = selected.includes(feature.id);

            return (
              <button
                type="button"
                key={feature.id}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelected((current) =>
                    current.includes(feature.id)
                      ? current.filter((item) => item !== feature.id)
                      : [...current, feature.id],
                  );
                }}
                className={cn(
                  "group rounded-xl border p-4 text-start transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out",
                  isSelected
                    ? "border-fd-primary/70 bg-fd-secondary hover:bg-fd-accent"
                    : "border-fd-border bg-fd-card hover:bg-fd-accent",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium">{feature.name}</span>
                  <span
                    className={cn(
                      "flex items-center justify-center size-4 rounded-full border transition-colors",
                      isSelected
                        ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
                        : "bg-fd-muted border-fd-muted-foreground text-fd-muted-foreground",
                    )}
                  >
                    <PlusIcon className="size-3.5" />
                  </span>
                </span>
                <span className="mt-2 block text-sm text-fd-muted-foreground">
                  {feature.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex flex-col dark rounded-xl border border-fd-border bg-fd-card shadow-lg shadow-black/50 h-[520px] [&_.shiki-magic-move-container]:flex-1 [&_.shiki-magic-move-container]:overflow-auto [&_.shiki-magic-move-container]:fd-scroll-container [&_.shiki-magic-move-container]:bg-transparent [&_.shiki-magic-move-container]:p-5 [&_.shiki-magic-move-container]:font-mono [&_.shiki-magic-move-container]:text-[13px] [&_.shiki-magic-move-container]:leading-6 [&_.shiki-magic-move-container]:md:text-sm">
        <div className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-fd-primary/70 to-transparent" />
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 border-b border-[oklch(95%_0.02_255/0.1)] px-5 py-3">
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-[oklch(67%_0.18_24)]" />
            <span className="size-3 rounded-full bg-[oklch(76%_0.15_82)]" />
            <span className="size-3 rounded-full bg-[oklch(70%_0.17_150)]" />
          </div>
          <span className="font-mono text-xs text-fd-muted-foreground">press.config.tsx</span>
        </div>

        <ShikiMagicMove
          code={code}
          highlighter={highlighter}
          lang="typescript"
          theme="vesper"
          options={magicMoveOptions}
        />
      </div>
    </section>
  );
}
