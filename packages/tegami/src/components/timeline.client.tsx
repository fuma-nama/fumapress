"use client";

import { cn } from "cn";
import { PackageIcon, SearchIcon, XIcon } from "lucide-react";
import {
  createContext,
  startTransition,
  use,
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChangelogEntryView } from "../lib/types.ts";
import { DateRangePicker, type DateRange } from "./date-range-picker.client.tsx";

interface ChangelogTimelineContextValue {
  allPackages: string[];
  packages: string[];
  setPackageFilters: (values: string[]) => void;
  range: DateRange;
  setRange: (range: DateRange) => void;
  query: string;
  setQuery: (query: string) => void;
  filtered: ChangelogEntryView[];
  grouped: [string, ChangelogEntryView[]][];
  hasMore: boolean;
  loadMore: () => void;
}

const ChangelogTimelineContext = createContext<ChangelogTimelineContextValue | null>(null);

function useChangelogTimeline() {
  const ctx = use(ChangelogTimelineContext);
  if (!ctx) throw new Error("Must be used within ChangelogTimelineProvider");
  return ctx;
}

export function ChangelogTimelineProvider({
  entries,
  initialPageSize = 10,
  children,
}: {
  entries: ChangelogEntryView[];
  initialPageSize?: number;
  children: ReactNode;
}) {
  const [packages, setPackages] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>({});
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(initialPageSize);
  const deferredQuery = useDeferredValue(query);

  const allPackages = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      for (const pkg of entry.packages) set.add(pkg.name);
    }
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const from = range.from && new Date(range.from);
    const to = (range.to && new Date(range.to)) || from;

    return entries.filter((entry) => {
      if (packages.length > 0 && !entry.packages.some((pkg) => packages.includes(pkg.name))) {
        return false;
      }

      if (from && entry.date < from) return false;
      if (to && entry.date > to) return false;

      if (q) {
        const hay =
          `${entry.title} ${entry.description ?? ""} ${entry.packages.map((p) => `${p.name}@${p.version}`).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [entries, packages, range, deferredQuery]);

  const visibleEntries = filtered.slice(0, visible);
  const grouped = useMemo(() => groupByMonth(visibleEntries), [visibleEntries]);

  return (
    <ChangelogTimelineContext
      value={{
        allPackages,
        packages,
        setPackageFilters: setPackages,
        range,
        setRange,
        query,
        setQuery,
        filtered,
        grouped,
        hasMore: visible < filtered.length,
        loadMore() {
          startTransition(() => setVisible((n) => n + 10));
        },
      }}
    >
      {children}
    </ChangelogTimelineContext>
  );
}

export function ChangelogFilterPanel() {
  const { allPackages, packages, setPackageFilters, range, setRange, query, setQuery } =
    useChangelogTimeline();
  const hasFilters = packages.length > 0 || Boolean(range.from) || query.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {allPackages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <PackageIcon className="size-3.5 text-fd-primary" />
          {allPackages.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setPackageFilters(
                  packages.includes(name)
                    ? packages.filter((p) => p !== name)
                    : [...packages, name],
                );
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-sm transition-colors font-mono text-xs",
                packages.includes(name)
                  ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
                  : "border-fd-border bg-fd-secondary text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <DateRangePicker value={range} onChange={setRange} />

        <div className="relative flex-1">
          <SearchIcon className="absolute start-2 top-1/2 -translate-y-1/2 size-3.5 text-fd-muted-foreground sm:start-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search releases…"
            className="size-full rounded-lg border border-fd-border bg-fd-secondary ps-7 pe-3 py-1.5 text-sm text-fd-secondary-foreground outline-none placeholder:text-fd-muted-foreground focus:border-fd-primary sm:ps-8"
          />
        </div>
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setPackageFilters([]);
            setRange({});
            setQuery("");
          }}
          className="inline-flex w-fit text-start items-center gap-2 p-2 -m-2 transition-colors text-fd-muted-foreground outline-none text-xs hover:text-fd-accent-foreground"
        >
          <XIcon className="size-3" />
          Clear Filters
        </button>
      )}
    </div>
  );
}

export function ChangelogContent() {
  const { filtered, grouped, hasMore, loadMore } = useChangelogTimeline();

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-fd-muted-foreground py-4">No releases match these filters.</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(([month, items]) => (
        <section key={month} className="relative">
          <h2 className="sticky top-0 z-1 bg-fd-background/80 py-4 text-sm font-medium text-fd-muted-foreground backdrop-blur-sm">
            {month}
          </h2>
          <ol className="relative ms-3 border-s border-fd-border ps-6">
            {items.map((entry) => (
              <li key={entry.url} className="relative pb-10 last:pb-0">
                <span className="absolute -start-6 translate-x-[calc(-50%-0.5px)] top-1.5 size-2.5 rounded-full border-2 border-fd-primary bg-fd-background" />
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <time
                    dateTime={entry.date.toISOString()}
                    className="text-xs font-medium tabular-nums text-fd-primary pe-2"
                  >
                    {formatDay(entry.date)}
                  </time>
                  {entry.packages.map((pkg) => (
                    <span
                      key={pkg.name}
                      className="rounded-md border shadow-sm bg-fd-secondary px-1.5 py-0.5 font-mono text-xs text-fd-secondary-foreground"
                    >
                      {pkg.name}@{pkg.version}
                    </span>
                  ))}
                </div>
                <article className="prose text-sm text-fd-muted-foreground max-w-none prose-h2:text-lg prose-h2:mb-3 prose-h3:text-base prose-h3:mb-2">
                  {entry.body}
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="mx-auto rounded-lg border border-fd-border bg-fd-card px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
        >
          Load more
        </button>
      )}
    </div>
  );
}

function groupByMonth(entries: ChangelogEntryView[]): [string, ChangelogEntryView[]][] {
  const map = new Map<string, ChangelogEntryView[]>();
  for (const entry of entries) {
    const key = formatMonth(entry.date);
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }
  return Array.from(map.entries());
}

function formatMonth(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
