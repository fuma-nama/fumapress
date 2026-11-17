import type { InjectionKey } from "vue";
import { cva } from "class-variance-authority";
import { buttonVariants } from "../../../../components/ui/button";

export const navItemVariants = cva("[&_svg]:size-4", {
  variants: {
    variant: {
      main: "inline-flex items-center gap-1 p-2 text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:text-fd-primary",
      button: buttonVariants({
        variant: "secondary",
        className: "gap-1.5",
      }),
      icon: buttonVariants({
        variant: "ghost",
        size: "icon",
      }),
    },
  },
  defaultVariants: {
    variant: "main",
  },
});

export const MobileNavigationMenuKey: InjectionKey<{
  setOpen: (v: boolean) => void;
}> = Symbol.for("fd-home-mobile-navigation-menu");
