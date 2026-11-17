import { cva } from "class-variance-authority";

/** the hover fill comes from the gliding block of `SidebarItems` */
export const itemVariants = cva(
  "relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start wrap-anywhere outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fd-ring [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      active: {
        true: "bg-fd-primary/10 text-fd-primary",
        false: "text-fd-muted-foreground hover:text-fd-accent-foreground",
      },
    },
    defaultVariants: { active: false },
  },
);
