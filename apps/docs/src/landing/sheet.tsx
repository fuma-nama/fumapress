import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn";

/**
 * A sheet of paper resting on the page, inked twice at its edge, with the cast shadow of the drawings (`.sheet-shadow`
 * in washi.css). The cord of the page passes behind it. Shared by server and client components.
 */
export function Sheet({
  children,
  className,
  paperClassName,
  style,
}: {
  children: ReactNode;
  /** the box on the page: its place and size */
  className?: string;
  /** the paper inside: its padding and layout */
  paperClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("relative", className)} style={style}>
      <div className="sheet-shadow" aria-hidden />
      <div
        className={cn(
          "relative z-1 rounded-sm border border-w-ink/60 bg-w-sheet bg-(image:--w-noise) dark:border-w-ink/35",
          // the second, lighter pass of the pen
          "after:pointer-events-none after:absolute after:-inset-px after:translate-x-px after:-translate-y-px after:rounded-sm after:border after:border-w-ink/25",
          paperClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
