import type { ReactNode } from "react";

export function Nesting({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 text-sm">{children}</div>;
}

export function Layer({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-fd-card p-3 [&_&]:mt-3 [&_&]:bg-fd-muted/50">
      <p className="font-mono text-xs font-medium text-fd-foreground">{title}</p>
      <p className="mt-1 text-fd-muted-foreground">{note}</p>
      {children}
    </div>
  );
}
