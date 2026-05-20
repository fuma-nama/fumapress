"use client";

import type { MagicMoveDifferOptions, MagicMoveRenderOptions } from "shiki-magic-move/core";
import { ShikiMagicMove } from "shiki-magic-move/react";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import typescript from "shiki/langs/typescript.mjs";
import vesper from "shiki/themes/vesper.mjs";
import "shiki-magic-move/style.css";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "./cn";

const features = [
  {
    id: "search",
    name: "Search",
    description: "Adds static full-text search across docs pages.",
    importLine: 'import { flexsearchPlugin } from "fumapress/plugins/flexsearch";',
    plugin: "flexsearchPlugin()",
  },
  {
    id: "llms",
    name: "llms.txt",
    description: "Publishes AI-readable indexes for your content.",
    importLine: 'import { llmsPlugin } from "fumapress/plugins/llms.txt";',
    plugin: "llmsPlugin()",
  },
  {
    id: "blog",
    name: "Blog",
    description: "Turns content collections into a polished blog.",
    importLine: 'import { blogPlugin } from "fumapress/plugins/blog";',
    plugin: "blogPlugin()",
  },
  {
    id: "takumi",
    name: "Takumi",
    description: "Generates beautiful Open Graph images for your content.",
    importLine: 'import { takumiPlugin } from "fumapress/plugins/takumi";',
    plugin: "takumiPlugin()",
  },
] as const;

type FeatureId = (typeof features)[number]["id"];

const initialSelected = ["search", "llms"] satisfies FeatureId[];

const magicMoveOptions: MagicMoveRenderOptions & MagicMoveDifferOptions = {
  containerStyle: false,
  duration: 400,
  lineNumbers: true,
  stagger: 0.3,
};

function createConfigCode(selected: readonly FeatureId[]) {
  const activeFeatures = features.filter((feature) => selected.includes(feature.id));
  const plugins = activeFeatures.map((feature) => feature.plugin);
  const hasBlog = selected.includes("blog");

  return [
    'import { defineConfig } from "fumapress";',
    'import { loader } from "fumadocs-core/source";',
    ...activeFeatures.map((feature) => feature.importLine),
    hasBlog
      ? 'import { blog, docs } from "./.source/server";'
      : 'import { docs } from "./.source/server";',
    "",
    "export default defineConfig({",
    "  loader: loader({",
    "    docs: docs.toFumadocsSource(),",
    ...(hasBlog ? ["    blog: blog.toFumadocsSource({", '      baseDir: "blog",', "    }),"] : []),
    "  }),",
    "})",
    plugins.length > 0 ? `  .usePlugins(${plugins.join(", ")});` : "  .usePlugins();",
  ].join("\n");
}

const highlighter = await createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  themes: [vesper],
  langs: [typescript],
});

export function HomeConfigPlayground() {
  const [selected, setSelected] = useState<FeatureId[]>(() => [...initialSelected]);
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

      <div className="relative flex flex-col dark rounded-xl border border-fd-border bg-fd-card shadow-lg shadow-black/50 min-h-[520px] [&_.shiki-magic-move-container]:flex-1 [&_.shiki-magic-move-container]:overflow-x-auto [&_.shiki-magic-move-container]:overflow-y-hidden [&_.shiki-magic-move-container]:bg-transparent [&_.shiki-magic-move-container]:px-5 [&_.shiki-magic-move-container]:py-5 [&_.shiki-magic-move-container]:font-mono [&_.shiki-magic-move-container]:text-[13px] [&_.shiki-magic-move-container]:leading-6 [&_.shiki-magic-move-container]:md:text-sm">
        <div className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-fd-primary/70 to-transparent" />
        <div className="flex items-center justify-between border-b border-[oklch(95%_0.02_255/0.1)] px-5 py-3">
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
