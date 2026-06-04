"use client";

import { Link } from "fumapress/client";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "./cn";
import { ShikiMagicMove } from "@shikijs/magic-move/react";
import { highlighter, magicMoveOptions } from "./home.client";

const plugins = [
  {
    id: "flexsearch",
    name: "FlexSearch",
    description: (
      <>
        Built-in full-text search with a static index and <code>/api/search</code>.
      </>
    ),
    keywords: ["search", "flexsearch"],
    docsHref: "/docs/plugins/flexsearch",
    usage: `import { defineConfig } from "fumapress";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";

export default defineConfig({
  // ...
}).plugins(flexsearchPlugin());`,
  },
  {
    id: "orama-search",
    name: "Orama Search",
    description: "Full-text search powered by Orama with the same search dialog UX.",
    keywords: ["search", "orama"],
    docsHref: "/docs/plugins/orama-search",
    usage: `import { defineConfig } from "fumapress";
import { oramaSearchPlugin } from "fumapress/plugins/orama-search";

export default defineConfig({
  // ...
}).plugins(oramaSearchPlugin());`,
  },
  {
    id: "llms",
    name: "llms.txt",
    description: (
      <>
        Expose <code>/llms.txt</code>, <code>/llms-full.txt</code>, and per-page markdown for AI
        tools.
      </>
    ),
    keywords: ["llm", "ai", "markdown"],
    docsHref: "/docs/plugins/llms.txt",
    usage: `import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";

export default defineConfig({
  // ...
}).plugins(llmsPlugin());`,
  },
  {
    id: "blog",
    name: "Blog",
    description: "Turn a content collection into blog routes, panels, and RSS.",
    keywords: ["blog", "rss", "posts"],
    docsHref: "/docs/plugins/blog",
    usage: `import { defineConfig } from "fumapress";
import { blog, docs } from "./.source/server";
import { blogPlugin } from "fumapress/plugins/blog";

export default defineConfig({
  content: {
    docs: docs.toFumadocsSource(),
    blog: blog.toFumadocsSource({ baseDir: "blog" }),
  },
}).plugins(blogPlugin());`,
  },
  {
    id: "takumi",
    name: "Takumi",
    description: "Generate Open Graph images for every docs page automatically.",
    keywords: ["og", "open graph", "social"],
    docsHref: "/docs/plugins/takumi",
    usage: `import { defineConfig } from "fumapress";
import { takumiPlugin } from "fumapress/plugins/takumi";

export default defineConfig({
  // ...
}).plugins(takumiPlugin());`,
  },
  {
    id: "image",
    name: "Image Optimization",
    description: "Responsive & optimized images via CDNs or a self-hosted endpoint.",
    keywords: ["image", "sharp", "vercel"],
    docsHref: "/docs/plugins/image",
    usage: `import { defineConfig } from "fumapress";
import { imagePlugin } from "fumapress/plugins/image/vercel";

export default defineConfig({
  // ...
}).plugins(imagePlugin());`,
  },
  {
    id: "sitemap",
    name: "Sitemap",
    description: (
      <>
        Generate <code>/sitemap.xml</code> from your content and static routes.
      </>
    ),
    keywords: ["seo", "sitemap", "xml"],
    docsHref: "/docs/plugins/sitemap",
    usage: `import { defineConfig } from "fumapress";
import { sitemapPlugin } from "fumapress/plugins/sitemap";

export default defineConfig({
  site: {
    baseUrl: "https://example.com",
  },
}).plugins(sitemapPlugin());`,
  },
  {
    id: "link-validation",
    name: "Link Validation",
    description: (
      <>
        Fail the build when rendered <code>{`<Link />`}</code> targets return 404.
      </>
    ),
    keywords: ["links", "404", "build"],
    docsHref: "/docs/plugins/link-validation",
    usage: `import { defineConfig } from "fumapress";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";

export default defineConfig({
  // ...
}).plugins(linkValidationPlugin());`,
  },
  {
    id: "openapi",
    name: "OpenAPI",
    description: "Generate API reference pages from an OpenAPI spec.",
    keywords: ["api", "openapi", "swagger"],
    docsHref: "/docs/plugins/openapi",
    usage: `import { defineConfig } from "fumapress";
import { createOpenAPI } from "fumadocs-openapi/server";
import { openapiPlugin } from "fumapress/plugins/openapi";

const openapi = createOpenAPI({
  input: ["./openapi.json"],
});

export default defineConfig({
  content: {
    openapi: await openapi.staticSource(),
  },
}).plugins(openapiPlugin({ server: openapi }));`,
  },
  {
    id: "ai",
    name: "AI",
    description: 'Add an "Ask AI" chat powered by the Vercel AI SDK.',
    keywords: ["chat", "ask ai", "gpt"],
    docsHref: "/docs/plugins/ai",
    usage: `import { defineConfig } from "fumapress";
import { openai } from "@ai-sdk/openai";
import { aiPlugin } from "@fumapress/ai";

export default defineConfig({
  // ...
}).plugins(
  aiPlugin({
    model: openai("gpt-5"),
  }),
);`,
  },
  {
    id: "feedback",
    name: "Feedback",
    description: "Collect page and text feedback with server actions or integrations.",
    keywords: ["feedback", "survey"],
    docsHref: "/docs/plugins/feedback",
    usage: `import { defineConfig } from "fumapress";
import { feedbackPlugin } from "@fumapress/feedback";

export default defineConfig({
  // ...
}).plugins(
  feedbackPlugin({
    onPageFeedbackAction(data) {
      "use server";
      // ...
    },
  }),
);`,
  },
] as const;

type Plugin = (typeof plugins)[number];

function matchesQuery(plugin: Plugin, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [plugin.name, plugin.description, plugin.id, ...plugin.keywords, plugin.usage]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function HomePluginExplorer() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<Plugin["id"]>(plugins[0].id);
  const listRef = useRef<HTMLUListElement>(null);
  const filtered = useMemo(() => plugins.filter((plugin) => matchesQuery(plugin, query)), [query]);

  const activePlugin = filtered.find((plugin) => plugin.id === activeId);
  if (!activePlugin && filtered.length > 0) setActiveId(filtered[0]!.id);

  function handleListKeyDown(event: React.KeyboardEvent) {
    function moveSelection(direction: 1 | -1) {
      if (filtered.length === 0) return;

      const currentIndex = filtered.findIndex((plugin) => plugin.id === activeId);
      const nextIndex =
        currentIndex === -1 ? 0 : (currentIndex + direction + filtered.length) % filtered.length;
      const next = filtered[nextIndex];

      if (next) {
        setActiveId(next.id);
        const item = listRef.current?.querySelector<HTMLElement>(`[data-plugin-id="${next.id}"]`);
        item?.scrollIntoView({ block: "nearest" });
      }
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-[1400px] gap-8 border-x border-b border-fd-border px-6 py-10 md:px-12 md:py-14">
      <div>
        <p className="text-sm font-medium text-fd-primary">Plugin Catalog</p>
        <h3 className="mt-4 max-w-lg text-3xl font-medium tracking-tight md:text-4xl">
          Robust, while minimal by default.
        </h3>
        <p className="mt-4 max-w-xl text-fd-muted-foreground">
          Search, image optimization, link validation, all made possible with plugins.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="flex min-h-[420px] flex-col gap-3">
          <label className="relative block">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fd-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleListKeyDown}
              placeholder="Search plugins…"
              className="w-full rounded-xl border border-fd-border bg-fd-card py-2.5 pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-fd-muted-foreground focus:border-fd-primary/70 focus:ring-2 focus:ring-fd-primary/20"
              aria-controls="plugin-explorer-list"
              aria-activedescendant={activePlugin ? `plugin-option-${activePlugin.id}` : undefined}
            />
          </label>

          <ul
            id="plugin-explorer-list"
            ref={listRef}
            role="listbox"
            aria-label="Plugins"
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            className="flex flex-1 flex-col overflow-y-auto rounded-xl border border-fd-border bg-fd-card p-1 min-h-[500px] max-h-[500px]"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-fd-muted-foreground">
                No plugins match your search.
              </li>
            ) : (
              filtered.map((plugin) => {
                const isActive = plugin.id === activePlugin?.id;

                return (
                  <li key={plugin.id} role="presentation">
                    <button
                      type="button"
                      id={`plugin-option-${plugin.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-plugin-id={plugin.id}
                      onClick={() => setActiveId(plugin.id)}
                      className={cn(
                        "relative w-full rounded-lg px-3 py-2.5 text-start outline-none",
                        isActive
                          ? "bg-fd-accent text-fd-accent-foreground"
                          : "text-fd-muted-foreground hover:text-fd-accent-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute start-1 inset-y-2 w-0.5 rounded-full bg-fd-primary opacity-0",
                          isActive && "opacity-100",
                        )}
                      />
                      <span className="block text-sm mb-1 font-medium">{plugin.name}</span>
                      <span className="block text-xs">{plugin.description}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {activePlugin ? (
          <div className="flex min-h-[420px] flex-col gap-4 px-5 py-4 rounded-xl border border-fd-border bg-fd-card">
            <div className="border-b border-fd-border">
              <h4 className="text-lg font-medium">{activePlugin.name}</h4>
              <p className="mt-2 text-sm text-fd-muted-foreground">{activePlugin.description}</p>
              <Link
                href={activePlugin.docsHref}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-fd-primary hover:underline"
              >
                View documentation
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>

            <div className="relative flex flex-col dark rounded-xl border border-fd-border bg-fd-secondary shadow-lg shadow-black/50 flex-1 [&_.shiki-magic-move-container]:flex-1 [&_.shiki-magic-move-container]:overflow-x-auto [&_.shiki-magic-move-container]:overflow-y-hidden [&_.shiki-magic-move-container]:bg-transparent [&_.shiki-magic-move-container]:p-5 [&_.shiki-magic-move-container]:font-mono [&_.shiki-magic-move-container]:text-[13px] [&_.shiki-magic-move-container]:leading-6 [&_.shiki-magic-move-container]:md:text-sm">
              <p className="font-mono text-xs text-center text-fd-muted-foreground border-b px-5 py-3">
                press.config.tsx
              </p>

              <ShikiMagicMove
                code={activePlugin.usage}
                highlighter={highlighter}
                lang="typescript"
                theme="vesper"
                options={magicMoveOptions}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
