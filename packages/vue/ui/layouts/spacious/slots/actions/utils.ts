// Base UI animates the popup with transitions from `data-starting-style` to `data-ending-style`, Reka UI waits for a CSS
// animation before it unmounts the content: the start is `@starting-style`, the end an animation of the closed state.
export const popupClass =
  "flex flex-col max-h-(--reka-dropdown-menu-content-available-height) overflow-y-auto rounded-2xl border bg-fd-popover text-sm text-fd-popover-foreground shadow-lg outline-none origin-(--reka-dropdown-menu-content-transform-origin) transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] starting:opacity-0 starting:scale-95 data-[state=closed]:animate-fd-popover-out motion-reduce:transition-none";

export const itemClass =
  "flex w-full min-h-9 items-center gap-3 rounded-lg px-2.5 py-1.5 text-start outline-none transition-colors duration-100 data-highlighted:bg-fd-accent data-highlighted:text-fd-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";
