"use client";
import { useState } from "react";
import { cn } from "cn";

type Render = "prerendered" | "on demand" | "gone";

const paths = ["/docs/install", "/docs/install.md", "/guides/setup", "/guides/setup.md"];

const scenes: {
  sources: string;
  caption: string;
  render: Render[];
  search: Extract<Render, "prerendered" | "on demand">;
}[] = [
  {
    sources: 'mode: "dynamic"',
    caption:
      "In v1, one option set the render mode of the whole site. With a Notion source, your Markdown pages also rendered on demand.",
    render: ["on demand", "on demand", "on demand", "on demand"],
    search: "on demand",
  },
  {
    sources: "docs: Fumadocs MDX, guides: Notion",
    caption:
      "In v2, each page uses the render mode of its source, and so do its Markdown file and Open Graph image. Search runs on the server because Notion content changes after the build.",
    render: ["prerendered", "prerendered", "on demand", "on demand"],
    search: "on demand",
  },
  {
    sources: "docs: Fumadocs MDX",
    caption:
      "Without the Notion source, nothing renders on demand, so you can deploy the site as static files.",
    render: ["prerendered", "prerendered", "gone", "gone"],
    search: "prerendered",
  },
];

function Row({ path, render }: { path: string; render: Render }) {
  const gone = render === "gone";

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span
        className={cn(
          "min-w-0 truncate font-mono text-xs transition-opacity duration-300 motion-reduce:transition-none",
          gone && "line-through opacity-40",
        )}
      >
        {path}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-300 motion-reduce:transition-none",
          render === "on demand" && "bg-fd-primary/10 text-fd-primary",
          render === "prerendered" && "bg-fd-secondary text-fd-muted-foreground",
          gone && "text-fd-muted-foreground/50",
        )}
      >
        {render}
      </span>
    </li>
  );
}

export function RenderingFigure() {
  const [step, setStep] = useState(0);
  const scene = scenes[step]!;

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border bg-fd-card">
      <div
        className="cursor-pointer p-3 sm:p-5"
        onClick={() => {
          // selecting text doesn't move on
          if (!getSelection()?.toString()) setStep((step + 1) % scenes.length);
        }}
      >
        <p className="mb-2 truncate px-1 font-mono text-xs text-fd-muted-foreground">
          {scene.sources}
        </p>
        <ul className="divide-y rounded-lg border bg-fd-background">
          {paths.map((path, i) => (
            <Row key={path} path={path} render={scene.render[i]!} />
          ))}
          <Row
            path={scene.search === "on demand" ? "/api/search" : "/api/search.json"}
            render={scene.search}
          />
        </ul>
      </div>
      <figcaption className="flex min-h-12 items-center gap-2 border-t px-3 py-2 text-sm">
        <div aria-live="polite" className="grid min-w-0 flex-1">
          {scenes.map((item, i) => (
            <p
              key={i}
              className={cn("col-start-1 row-start-1 text-pretty", i !== step && "invisible")}
            >
              <span className="me-2 font-mono text-xs tabular-nums text-fd-muted-foreground">
                {i + 1}/{scenes.length}
              </span>
              {item.caption}
            </p>
          ))}
        </div>
        <div className="flex shrink-0 items-center">
          {scenes.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Step ${i + 1}`}
              aria-current={i === step}
              className="group p-1"
              onClick={() => setStep(i)}
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full bg-fd-muted-foreground transition-[width,background-color] duration-300 group-hover:bg-fd-foreground motion-reduce:transition-none",
                  i === step ? "w-5 bg-fd-foreground" : "w-1.5",
                )}
              />
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
