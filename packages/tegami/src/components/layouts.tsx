import type { AppShape } from "fumapress";
import { getPressContext, type AppContext } from "fumapress";
import { createHomeLayout, type HomeLayoutOptions } from "fumapress/layouts/home";
import type { ReactNode } from "react";
import { getChangelogContext } from "../context.ts";
import type { ChangelogIndexPage, ChangelogLayout } from "../plugin.tsx";
import { getPackages } from "../lib/packages.ts";
import type { ChangelogEntryView } from "../lib/types.ts";
import {
  ChangelogContent,
  ChangelogFilterPanel,
  ChangelogTimelineProvider,
} from "./timeline.client.tsx";

declare module "fumapress" {
  export interface Adapter<C extends AppShape = AppShape> {
    "tegami:get-date"?: (page: C["page"]) => Date | Promise<Date>;
  }
}

export function createChangelogLayout<C extends AppShape>(
  options?: HomeLayoutOptions<C>,
): ChangelogLayout<C> {
  return createHomeLayout(options);
}

export interface ChangelogIndexPageOptions<C extends AppShape = AppShape> {
  heading?: ReactNode;
  description?: ReactNode;
  /** How many entries to show before "Load more". @default 10 */
  pageSize?: number;
  render?: (this: AppContext<C>, page: C["page"]) => Promise<{ body?: ReactNode } | undefined>;
}

export function createChangelogIndexPage<C extends AppShape = AppShape>({
  heading,
  description,
  pageSize = 10,
  render,
}: ChangelogIndexPageOptions<C> = {}): ChangelogIndexPage<C> {
  return async function ChangelogIndexPage({ lang }) {
    const ctx = getPressContext<C>();
    const { isChangelog } = getChangelogContext<C>();
    const source = await ctx.getLoader();
    const entries = await collectEntries(
      ctx,
      source.getPages(lang).filter(isChangelog.bind(ctx)),
      render,
    );

    return (
      <ChangelogTimelineProvider entries={entries} initialPageSize={pageSize}>
        <div className="flex flex-col gap-4 border-y bg-fd-card px-4 py-3.5 text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
          <h1 className="text-2xl font-semibold">{heading ?? "Changelog"}</h1>
          <p className="text-fd-muted-foreground empty:hidden">
            {description ?? "Release notes for packages."}
          </p>
          <ChangelogFilterPanel />
        </div>
        <ChangelogContent />
      </ChangelogTimelineProvider>
    );
  };
}

async function collectEntries<C extends AppShape>(
  ctx: AppContext<C>,
  pages: C["page"][],
  render?: (this: AppContext<C>, page: C["page"]) => Promise<{ body?: ReactNode } | undefined>,
): Promise<ChangelogEntryView[]> {
  const entries: ChangelogEntryView[] = [];

  for (const page of pages) {
    let date: Date | undefined;
    for (const adapter of ctx.adapters) {
      date = await adapter["tegami:get-date"]?.call(ctx, page);
      if (date) break;
    }
    date ??= new Date();

    let body = (await render?.call(ctx, page))?.body;
    if (body === undefined) {
      body = (await ctx.getPageBody(page))?.node;
    }
    if (body === undefined) {
      throw new Error(
        "[@fumapress/tegami] Missing body renderer. Configure fumadocsMdx() or pass `render` to createChangelogIndexPage().",
      );
    }

    const packages = getPackages(page.data) ?? {};
    entries.push({
      url: page.url,
      title: page.data.title ?? page.url,
      description: page.data.description,
      date,
      packages: Object.entries(packages)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, { version }]) => ({
          name,
          version,
        })),
      body,
    });
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  return entries;
}
