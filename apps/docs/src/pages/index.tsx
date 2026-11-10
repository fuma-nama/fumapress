import { Fragment, type ReactNode } from "react";
import { Link } from "fumapress/client";
import { StarIcon } from "lucide-react";
import { cn } from "../cn";
import { asMarkdown, md } from "fumapress/markdown";
import type { WakuRouteConfig } from "fumapress";
import { commands, plugins } from "../home.data";
import { InkDefs, Jack, Socket, Mark, Sheet, pressJack } from "../landing/ink";
import { Painting, Still } from "../landing/painting";
import { VIEWBOX, glass, panes } from "../landing/figures/window";
import { Rain } from "../landing/rain";
import { Envelopes, Welcome } from "../landing/marginalia";
import {
  CopyCommand,
  CordLayer,
  InView,
  PluginCard,
  PluginIndex,
  PluginList,
  type PluginEntry,
} from "../landing/landing.client";
import { highlight } from "../landing/code";
import { Playground } from "../landing/playground/playground";
import { bannerImage } from "../og/og";

const description = "The composable site generator powered by Fumadocs";

export function getConfig() {
  return {
    data: { title: "Fumapress", description, ogImage: { node: bannerImage() } },
  } satisfies WakuRouteConfig;
}

const copy = {
  title: "Turn your Markdown into a documentation site.",
  lead: "Fumapress is a site generator for docs, blogs and API references, offering a polished theme, search and other features with zero configuration.",
  files: {
    title: "Only the writing is left to you.",
    body: [
      "Each file you write becomes a page, and each folder a chapter in the sidebar. There are no routes to wire and no layouts to keep in step.",
      "When words alone fall short, MDX lets you set a React component between the lines.",
    ],
  },
  sources: {
    title: "Publish content from any source as one site.",
    body: "Keep pages as files in your repository, or fetch them from Notion, Obsidian, Sanity or a source of your own. Fumapress serves each source under its own path.",
  },
  layouts: {
    title: "It looks finished on day one, and stays yours to change.",
    body: [
      "Every page is built on Fumadocs UI, a design already refined on many documentation sites, with dark mode and phone layouts included. Pick a layout and a color theme, and there is nothing left to design.",
      "When you want your own design, the Fumadocs CLI installs any component or layout into your project, where its source is yours to edit.",
    ],
  },
  playground: {
    title: "Try it here before you install anything.",
  },
  support: {
    title: "A star helps Fumapress reach the next writer.",
  },
  plugins: {
    title: "When your docs grow, the site grows with them.",
    body: "A blog for your news, a changelog for your releases, an AI that answers from your pages, a reference drawn from your API spec. Each is one plugin away.",
  },
  start: {
    title: "Your first page is one command away.",
  },
};

const multipleSources = `export default createPress({
  docs: docs.toFumadocsSource({ baseDir: "docs" }),
  guides: notion.dynamicSource({ baseDir: "guides" }),
  // a vault and a Sanity dataset join the same way
}).plugins(notionPlugin({ notion }));`;

const cliCommands = ["npx @fumadocs/cli customize", "npx @fumadocs/cli add banner"];

/** the plugins of the index, in the order a reader looks for them */
const pluginIndex: {
  id: (typeof plugins)[number]["id"];
  name?: string;
  short: string;
  /** the words of the lines the plugin adds to a config */
  focus: RegExp[];
}[] = [
  { id: "blog", short: "posts, index and tags", focus: [/blog/] },
  { id: "tegami", name: "Changelog", short: "release timeline", focus: [/changelog/] },
  { id: "ai", name: "AI Chat", short: "answers from your docs", focus: [/openai|model/] },
  { id: "mcp", short: "docs for MCP clients", focus: [/mcp/i] },
  { id: "openapi", short: "REST reference", focus: [/openapi/i] },
  { id: "asyncapi", short: "event reference", focus: [/asyncapi/i] },
  { id: "link-validation", short: "fails on broken links", focus: [/linkValidation/] },
  { id: "feedback", short: "ratings and comments", focus: [/feedback|analytics/i] },
];

const frameworks = [
  {
    name: "Waku",
    note: "Custom pages are React Server Components.",
    command: "npm create fumapress -- --framework waku",
    href: "/docs",
  },
  {
    name: "Astro",
    note: "Custom pages are .astro files with React islands.",
    command: "npm create fumapress -- --framework astro",
    href: "/docs/astro",
  },
];

export default function Page() {
  if (asMarkdown()) return pageMarkdown();

  const entries: PluginEntry[] = pluginIndex.map((item) => {
    const plugin = plugins.find((p) => p.id === item.id)!;
    return {
      id: plugin.id,
      name: item.name ?? plugin.name,
      short: item.short,
      description: plugin.description,
      docsHref: plugin.docsHref,
      // the lines the plugin adds stand out, the rest of the config is dimmed
      html: highlight(plugin.usage, "tsx", (line) =>
        [/plugin/i, ...item.focus].some((word) => word.test(line)),
      ),
    };
  });

  return (
    <>
      <meta property="og:title" content="Fumapress" />
      <meta property="og:description" content={description} />
      <div
        data-washi=""
        className="-mx-4 px-4 max-xl:overflow-x-clip text-w-text xl:mx-auto xl:w-full xl:max-w-6xl xl:px-2"
      >
        <InkDefs />
        <CordLayer>
          <Hero />

          <Chapter
            mark="原稿"
            gloss="The manuscript"
            title={copy.files.title}
            body={copy.files.body}
            aside={<Still name="manuscript" />}
            figure={
              // the devices stand on the page; the cord plugs into the book and leaves from the clipboard
              <InView className="relative">
                <Jack edge="top" x={86.5} y={7.2} />
                <Painting name="files" />
                <Jack edge="bottom" x={11.5} y={83.7} wander={[0.44, 0.5]} />
              </InView>
            }
          />

          <Chapter
            mark="丁合"
            gloss="Gathering"
            title={copy.sources.title}
            body={copy.sources.body}
            aside={<Envelopes />}
            figure={
              <div>
                {/* the cord plugs into the last source; the config that joins them is on a slip below */}
                <InView className="relative">
                  <Jack edge="top" x={90.4} y={17.9} />
                  <Painting name="sources" />
                </InView>
                <Sheet className="mt-8">
                  <div
                    className="w-code"
                    dangerouslySetInnerHTML={{ __html: highlight(multipleSources) }}
                  />
                  <Jack edge="bottom" x={74} wander={[0.76, 0.66]} />
                </Sheet>
              </div>
            }
          />

          <Chapter
            mark="装丁"
            gloss="Binding"
            title={copy.layouts.title}
            body={[copy.layouts.body[0], <Still key="fan" name="swatches" />, copy.layouts.body[1]]}
            figure={
              // into the Docs plate, out of the card box of your project
              <InView className="relative">
                <Jack edge="top" x={11.5} y={6.4} />
                <Painting name="layouts" />
                <Jack edge="bottom" x={69} y={96.4} wander={[0.74, 0.7]} />
              </InView>
            }
          />

          <PluginIndex plugins={entries}>
            <Chapter
              mark="付録"
              gloss="Appendix"
              title={copy.plugins.title}
              body={copy.plugins.body}
              aside={<PluginList />}
              figure={
                <InView>
                  <PluginCard
                    cartridge={<Painting name="cartridge" />}
                    top={<Jack edge="top" x={23} y={6.3} />}
                    bottom={<Jack edge="bottom" x={60} wander={[0.8, 0.76]} />}
                  />
                </InView>
              }
            />
          </PluginIndex>

          <section
            id="playground"
            className="mx-auto flex w-full max-w-3xl scroll-mt-16 flex-col gap-y-8 py-20 xl:max-w-none xl:flex-row xl:gap-x-14 xl:py-36"
          >
            <div className="xl:order-last xl:w-14 xl:shrink-0">
              <Mark gloss="Test print">試し刷り</Mark>
            </div>
            <div className="min-w-0 xl:flex-1 xl:pt-3">
              <h2 className="font-serif max-w-xl text-3xl font-light tracking-tight text-balance text-w-ink xl:text-4xl">
                {copy.playground.title}
              </h2>
              <div className="mt-14">
                <Playground device={<Still name="device" />} />
              </div>
            </div>
          </section>

          <Chapter
            mark="奥付"
            gloss="Colophon"
            title={copy.start.title}
            figure={
              <Sheet>
                <Jack edge="top" x={70} />
                {frameworks.map((fw, i) => (
                  <div
                    key={fw.name}
                    className={cn(
                      "flex flex-col gap-x-8 gap-y-4 p-6 sm:flex-row sm:items-center",
                      i > 0 && "border-t border-w-ink/25",
                    )}
                  >
                    <div className="sm:w-40 sm:shrink-0">
                      <p className="font-serif text-2xl text-w-ink">{fw.name}</p>
                      <Link
                        href={fw.href}
                        className="mt-1 inline-block font-serif text-base text-w-muted underline decoration-w-ink/35 underline-offset-4 transition-colors hover:decoration-w-ink"
                      >
                        Quick Start
                      </Link>
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-base text-w-muted">{fw.note}</p>
                      <CopyCommand command={fw.command} className="mt-3 text-left text-xs" />
                    </div>
                  </div>
                ))}
                <Jack edge="bottom" x={36} wander={[0.1, 0.08]} />
              </Sheet>
            }
          />

          {/* a space of its own between the last chapter and the window */}
          <section aria-label="Welcome" className="-mt-10 xl:-mt-24">
            <Welcome
              ring={<Still name="ring" />}
              colophon={<Still name="colophon" className="w-2/3 overflow-visible" />}
            />
          </section>

          <Ending />
        </CordLayer>
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-y-10 pt-6 pb-8 xl:max-w-none xl:flex-row xl:gap-x-10 xl:pt-14 xl:pb-4">
      <div className="flex min-w-0 flex-col xl:flex-5 xl:pt-38">
        <h1 className="font-serif text-4xl font-light tracking-tight text-balance text-w-ink sm:text-5xl">
          {copy.title}
        </h1>
        <p className="font-serif mt-7 max-w-md text-lg leading-relaxed text-w-text/80">
          {copy.lead}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full bg-w-label px-4.5 py-2.5 font-serif text-sm font-medium text-w-paper shadow-flat transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-flat-sm dark:bg-w-ink"
          >
            Quick Start
          </Link>
          <a
            href="#playground"
            className="font-serif text-base text-w-ink underline decoration-w-ink/35 underline-offset-4 transition-colors hover:decoration-w-ink"
          >
            or try it in the playground
          </a>
        </div>
      </div>
      <InView className="relative mx-auto w-full max-w-lg xl:flex-6">
        <Painting name="hero" embed />
        <span
          data-cord="start"
          data-wander="0.6,0.56"
          className="absolute size-px"
          style={{
            left: `${(pressJack.x / pressJack.width) * 100}%`,
            top: `${((pressJack.y - pressJack.top) / pressJack.height) * 100}%`,
          }}
        />
      </InView>
      <div className="hidden w-14 shrink-0 flex-col items-center gap-5 pt-16 xl:flex" aria-hidden>
        <span className="h-24 w-px bg-w-rule" />
        <span className="tate font-serif text-2xl leading-none tracking-spine text-w-ink">
          言の葉を刷る
        </span>
        <span className="h-24 w-px bg-w-rule" />
      </div>
    </section>
  );
}

function Chapter({
  mark,
  gloss,
  title,
  body,
  aside,
  figure,
}: {
  mark: string;
  gloss: string;
  title: string;
  /** one string per paragraph, with objects set between them */
  body?: ReactNode | ReactNode[];
  aside?: ReactNode;
  figure: ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-y-8 py-20 xl:max-w-none xl:flex-row xl:items-start xl:gap-x-14 xl:py-36">
      <div className="xl:order-last xl:w-14 xl:shrink-0">
        <Mark gloss={gloss}>{mark}</Mark>
      </div>
      <div className="min-w-0 xl:flex-4 xl:pt-3">
        <h2 className="font-serif text-3xl font-light tracking-tight text-balance text-w-ink xl:text-4xl">
          {title}
        </h2>
        {(Array.isArray(body) ? body : body === undefined ? [] : [body]).map((paragraph, i) =>
          typeof paragraph === "string" ? (
            <p
              key={i}
              className={cn(
                "font-serif max-w-md text-lg leading-relaxed text-w-text/80",
                i === 0 ? "mt-6" : "mt-4",
              )}
            >
              {paragraph}
            </p>
          ) : (
            <Fragment key={i}>{paragraph}</Fragment>
          ),
        )}
        {aside}
      </div>
      <div className="mt-20 min-w-0 xl:mt-0 xl:flex-7">{figure}</div>
    </section>
  );
}

/** the last page: rain at a window, the cord ending in the socket on the wall beside it */
function Ending() {
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-y-12 pt-8 pb-20 xl:max-w-none xl:flex-row xl:items-center xl:gap-x-12 xl:pt-10 xl:pb-28">
      {/* room for the socket on the wall: on the left, and under the sill on phones */}
      <div className="min-w-0 max-xl:pb-20 xl:flex-7 xl:pl-24">
        <InView className="relative w-full max-w-2xl">
          {/* the town outside, the rain, then the glass and the room in front of it */}
          <Still name="outside" className="block h-auto w-full" />
          <Rain glass={glass} panes={panes} viewBox={VIEWBOX} />
          <Still name="window" className="absolute inset-0 size-full" />
          {/* the cord ends in the socket on the wall: left of the window, under its sill on phones */}
          <Socket className="absolute! top-full left-1/16 xl:top-3/5 xl:-left-1/7" />
        </InView>
      </div>
      {/* the call to support, beside the scene, and under it on phones */}
      <div className="max-w-md xl:flex-4">
        <h2 className="font-serif text-3xl font-light text-balance text-w-ink">
          {copy.support.title}
        </h2>
        <a
          href="https://github.com/fuma-nama/fumapress"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-w-label px-4.5 py-2.5 font-serif text-sm font-medium text-w-paper shadow-flat transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-flat-sm dark:bg-w-ink"
        >
          <StarIcon className="size-4" strokeWidth={1.5} />
          Star on GitHub
        </a>
      </div>
      {/* set vertically at the edge of the page, and across it under the call on phones */}
      <div
        className="flex items-center justify-center gap-4 xl:w-14 xl:shrink-0 xl:flex-col xl:gap-5 xl:self-start"
        aria-hidden
      >
        <span className="h-px w-10 bg-w-rule xl:h-20 xl:w-px" />
        <span className="font-serif text-base leading-none tracking-widest whitespace-nowrap text-w-ink-soft xl:text-lg xl:tate xl:tracking-spine">
          続きは、あなたの手で
        </span>
        <span className="h-px w-10 bg-w-rule xl:h-20 xl:w-px" />
      </div>
    </div>
  );
}

/** the Markdown form of the landing page, see `routes: "all"` of the llms.txt plugin */
function pageMarkdown() {
  return md`# Fumapress

> ${copy.title}

${copy.lead}

- [Quick Start](/docs)

\`\`\`bash
${commands.npm}
\`\`\`

## ${copy.files.title}

${copy.files.body.join("\n\n")}

## ${copy.sources.title}

${copy.sources.body}

\`\`\`tsx title="press.config.tsx"
${multipleSources}
\`\`\`

## ${copy.layouts.title}

${copy.layouts.body.join("\n\n")}

\`\`\`bash
${cliCommands.join("\n")}
\`\`\`

## ${copy.plugins.title}

${copy.plugins.body}

${pluginIndex.map(({ id, name }) => {
  const plugin = plugins.find((p) => p.id === id)!;
  return md`### ${name ?? plugin.name}

${plugin.description}

[Documentation](${plugin.docsHref})

\`\`\`ts title="press.config.tsx"
${plugin.usage}
\`\`\`

`;
})}

## ${copy.start.title}

Fumapress is written by Fuma Nama, built on Fumadocs and released under the MIT license.

${frameworks.map(
  (fw) => md`### ${fw.name}

${fw.note} [Quick Start](${fw.href})

\`\`\`bash
${fw.command}
\`\`\`

`,
)}

## ${copy.support.title}

[Star on GitHub](https://github.com/fuma-nama/fumapress)
`;
}
