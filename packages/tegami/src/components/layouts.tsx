import type { ReactNode } from "react";
import type { ChangelogIndexViewProps } from "../plugin.tsx";
import {
  ChangelogContent,
  ChangelogFilterPanel,
  ChangelogTimelineProvider,
  type ChangelogEntryView,
} from "./timeline.client.tsx";

export interface ChangelogViewOptions {
  heading?: ReactNode;
  description?: ReactNode;
  /** How many entries to show before "Load more". @default 10 */
  pageSize?: number;
}

/** the entries on a timeline, with filters by package, date and text */
export function ChangelogIndexView({
  entries,
  heading,
  description,
  pageSize = 10,
}: ChangelogIndexViewProps & ChangelogViewOptions) {
  const now = new Date();
  const views: ChangelogEntryView[] = [];
  for (const { page, date = now, packages, body } of entries) {
    views.push({
      url: page.url,
      title: page.data.title ?? page.url,
      description: page.data.description,
      date,
      packages,
      body,
    });
  }

  return (
    <ChangelogTimelineProvider entries={views} initialPageSize={pageSize}>
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
}
