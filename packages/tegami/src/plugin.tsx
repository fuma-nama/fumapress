import type { AppShape, Plugin, SourcePage } from "@fumapress/core";
import type { Page } from "fumadocs-core/source";
import type { ReactNode } from "react";
import { getPackages } from "./lib/packages.ts";
import { ChangelogIndexView } from "./components/layouts.tsx";

declare module "@fumapress/core" {
  interface CapabilityAPI {
    changelog: undefined;
  }
}

export interface ChangelogPluginOptions<S> {
  /** the source keys of the changelog pages */
  source: S | readonly S[];
  paths?: {
    /**
     * pathname for index page
     *
     * @default "/changelog"
     */
    index?: string | false;
  };
}

export interface ChangelogEntry<P = Page> {
  page: P;
  /** the creation date of the page, like its `date` frontmatter */
  date?: Date;
  /** the released packages, by name */
  packages: { name: string; version: string }[];
  /** the rendered content of the page */
  body: ReactNode;
}

export interface ChangelogIndexViewProps<P = Page> {
  /** newest first, entries without a date come first */
  entries: ChangelogEntry<P>[];
}

export type ChangelogTypes<P> = {
  provides: "changelog";
  views: { "changelog.index": ChangelogIndexViewProps<P> };
};

/** The release notes of the `source` keys on one page, in every language. */
export function changelogPlugin<
  C extends AppShape = AppShape,
  const S extends C["source"] = C["source"],
>(options: ChangelogPluginOptions<S>): Plugin<C, ChangelogTypes<SourcePage<C, S>>> {
  type Entry = ChangelogEntry<SourcePage<C, S>>;
  const indexPath = options.paths?.index ?? "/changelog";
  const source: readonly S[] = Array.isArray(options.source)
    ? options.source
    : [options.source as S];
  const isEntry = (page: C["page"]): page is SourcePage<C, S> => source.includes(page.type as S);

  return {
    name: "tegami:changelog",
    provides: ["changelog"],
    views({ lang }) {
      if (indexPath === false) return;
      return [
        {
          path: indexPath,
          view: async () => {
            const pending: Promise<Entry>[] = [];
            for (const page of (await this.getLoader()).getPages(lang)) {
              if (!isEntry(page)) continue;
              pending.push(
                Promise.all([this.getPageCreatedAt(page), this.getPageBody(page)]).then(
                  ([date, body]) => {
                    if (!body)
                      throw new Error(
                        `[@fumapress/tegami] the changelog page "${page.path}" has no body, its content source doesn't render it.`,
                      );
                    const packages: Entry["packages"] = [];
                    for (const [name, { version }] of Object.entries(getPackages(page.data) ?? {}))
                      packages.push({ name, version });
                    packages.sort((a, b) => a.name.localeCompare(b.name));
                    return { page, date, packages, body: body.node };
                  },
                ),
              );
            }
            const now = Date.now();
            const entries = (await Promise.all(pending)).sort(
              (a, b) => (b.date?.getTime() ?? now) - (a.date?.getTime() ?? now),
            );
            return {
              type: "changelog.index",
              props: { entries },
              node: <ChangelogIndexView entries={entries} />,
            };
          },
        },
      ];
    },
  };
}
