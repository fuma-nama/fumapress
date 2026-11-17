import { cva } from "class-variance-authority";

export const itemVariants = cva(
  "flex flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4",
);
