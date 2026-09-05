"use client";

import { Popover } from "@base-ui/react/popover";
import { cn } from "cn";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type DateRange = { from?: string; to?: string };

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(() => startOfMonth(parseISO(value.from) ?? new Date()));
  const [hover, setHover] = useState<string | undefined>();

  const days = useMemo(() => monthGrid(visible), [visible]);
  const label = formatRangeLabel(value);
  const active = Boolean(value.from || value.to);

  function selectDay(iso: string) {
    // first click or completed range → start new range
    if (!value.from || (value.from && value.to)) {
      onChange({ from: iso, to: undefined });
      return;
    }
    if (iso < value.from) onChange({ from: iso, to: value.from });
    else onChange({ from: value.from, to: iso });
  }

  function clear() {
    onChange({});
    setHover(undefined);
  }

  const previewTo = value.from && !value.to ? hover : value.to;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "inline-flex text-start items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-fd-primary/10 text-fd-primary"
            : "bg-fd-secondary text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
        )}
      >
        <CalendarIcon className="size-3.5 shrink-0" />
        <span className="tabular-nums truncate">{label}</span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" className="z-50 outline-none">
          <Popover.Popup className="origin-(--transform-origin) rounded-xl border border-fd-border bg-fd-popover p-3 text-fd-popover-foreground shadow-lg outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setVisible(addMonths(visible, -1))}
                className="rounded-lg p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <Popover.Title className="text-sm font-medium">
                {visible.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </Popover.Title>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setVisible(addMonths(visible, 1))}
                className="rounded-lg p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-medium text-fd-muted-foreground">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => setHover(undefined)}>
              {days.map((day, i) => {
                if (!day) return <span key={`e-${i}`} />;
                const inRange = isInRange(day, value.from, previewTo);
                const isStart = day === value.from;
                const isEnd = day === (value.to ?? (value.from && !value.to ? hover : undefined));
                const isEdge = isStart || isEnd;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    onMouseEnter={() => setHover(day)}
                    className={cn(
                      "relative size-8 rounded-lg text-sm tabular-nums transition-colors",
                      inRange && !isEdge && "bg-fd-primary/15 text-fd-foreground",
                      isEdge && "bg-fd-primary text-fd-primary-foreground",
                      !inRange &&
                        !isEdge &&
                        "text-fd-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-fd-border pt-2">
              <p className="text-xs text-fd-muted-foreground">
                {value.from && !value.to ? "Select end date" : "Pick a date range"}
              </p>
              {active && (
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
                >
                  <XIcon className="size-3" />
                  Clear
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatRangeLabel(value: DateRange): string {
  if (!value.from && !value.to) return "All time";
  if (value.from && !value.to) return `${formatShort(value.from)} – …`;
  if (value.from && value.to) {
    if (value.from === value.to) return formatShort(value.from);
    return `${formatShort(value.from)} – ${formatShort(value.to)}`;
  }
  return "All time";
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isInRange(day: string, from?: string, to?: string): boolean {
  if (!from || !to) return false;
  const a = from < to ? from : to;
  const b = from < to ? to : from;
  return day >= a && day <= b;
}

function parseISO(iso?: string): Date | undefined {
  if (!iso) return;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return;
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function monthGrid(month: Date): (string | undefined)[] {
  const year = month.getUTCFullYear();
  const mon = month.getUTCMonth();
  const firstDow = new Date(Date.UTC(year, mon, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const cells: (string | undefined)[] = Array.from({ length: firstDow }, () => undefined);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toISO(new Date(Date.UTC(year, mon, d))));
  }
  while (cells.length % 7 !== 0) cells.push(undefined);
  return cells;
}
