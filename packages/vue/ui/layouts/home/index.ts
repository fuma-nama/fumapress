import type { Component } from "vue";
import type { BaseLayoutProps, BaseSlots, NavOptions } from "../shared";

export { default as HomeLayout } from "./HomeLayout.vue";
export { useHomeLayout } from "./context";

/** the other attributes reach the container, a `<main>` by default */
export interface HomeLayoutProps extends BaseLayoutProps {
  nav?: Nav;
  slots?: Partial<HomeSlots>;
}

interface Nav extends NavOptions {
  /**
   * Open mobile menu when hovering the trigger
   */
  enableHoverToOpen?: boolean;
}

export interface HomeSlots extends BaseSlots {
  /** receives the attributes of a `<header>` */
  header: Component;
  /** receives the attributes of a `<main>` */
  container: Component;
}
