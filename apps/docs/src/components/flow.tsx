import type { ReactNode } from "react";

/** what runs in order, top to bottom */
export function Flow({ children }: { children: ReactNode }) {
  return <ol className="not-prose my-6 flex list-none flex-col text-sm">{children}</ol>;
}

export function FlowStep({
  title,
  result,
  children,
}: {
  title: string;
  /** what the step hands to the next one */
  result?: string;
  children: ReactNode;
}) {
  return (
    <li className="group relative flex gap-3 pb-3 last:pb-0">
      <span
        aria-hidden
        className="absolute top-5 bottom-0 left-[5px] w-px bg-fd-border group-last:hidden"
      />
      <span
        aria-hidden
        className="relative mt-3.5 size-[11px] shrink-0 rounded-full border-2 border-fd-primary bg-fd-background"
      />
      <div className="min-w-0 flex-1 rounded-xl border bg-fd-card p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <code className="font-mono text-xs font-medium text-fd-foreground">{title}</code>
          {result && <code className="font-mono text-xs text-fd-primary">{result}</code>}
        </div>
        <div className="mt-1 text-fd-muted-foreground">{children}</div>
      </div>
    </li>
  );
}
