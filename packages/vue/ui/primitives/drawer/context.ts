import {
  inject,
  shallowRef,
  type Component,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from "vue";

/**
 * The Drawer of Base UI (`@base-ui/react/drawer`), for what Reka UI lacks: a drawer that keeps the state
 * attributes of Base UI (`data-open`, `data-starting-style`, `data-swiping`, ...) and its CSS variables.
 */

export type SwipeDirection = "up" | "down" | "left" | "right";

export type TransitionStatus = "starting" | "ending" | undefined;

export type OpenChangeReason =
  | "trigger-press"
  | "close-press"
  | "outside-press"
  | "escape-key"
  | "swipe"
  | "imperative-action";

export interface DrawerStore {
  open: Readonly<Ref<boolean>>;
  mounted: Readonly<Ref<boolean>>;
  transitionStatus: Readonly<Ref<TransitionStatus>>;
  swipeDirection: Readonly<Ref<SwipeDirection>>;
  /** the id of the popup when it has none of its own */
  floatingId: string;
  titleId: Ref<string | undefined>;
  /** the id of the trigger that opened the drawer */
  activeTriggerId: Readonly<Ref<string | null>>;
  popupElement: ShallowRef<HTMLElement | null>;
  backdropElement: ShallowRef<HTMLElement | null>;
  internalBackdropElement: ShallowRef<HTMLElement | null>;
  viewportElement: ShallowRef<HTMLElement | null>;
  /** the measured height of the popup */
  popupHeight: Ref<number>;
  setOpen: (open: boolean, reason: OpenChangeReason, triggerId?: string | null) => void;
}

export interface DrawerRootProps {
  /** a handle to open and close the drawer, and to associate it with detached triggers */
  handle?: DrawerHandle;
  /**
   * The direction in which the drawer can be swiped to dismiss it.
   * @defaultValue 'down'
   */
  swipeDirection?: SwipeDirection;
}

export interface DrawerTriggerProps {
  /** the handle of a root the trigger is outside of */
  handle?: DrawerHandle;
  /**
   * The element or component to render.
   * @defaultValue 'button'
   */
  as?: string | Component;
  /** render the child element instead, with the props of the trigger; the slot receives `{ open }` */
  asChild?: boolean;
}

export interface DrawerTitleProps {
  /**
   * The element or component to render, it receives the `id` of the title.
   * @defaultValue 'h2'
   */
  as?: string | Component;
}

export const DrawerRootKey: InjectionKey<DrawerStore> = Symbol("drawer-root");

export function useDrawerRootContext(): DrawerStore {
  const store = inject(DrawerRootKey, null);
  if (!store)
    throw new Error(
      "Base UI: DrawerRootContext is missing. Drawer parts must be placed within <Drawer.Root>.",
    );
  return store;
}

/**
 * Controls a Drawer imperatively and associates detached `Drawer.Trigger` components with a `Drawer.Root`.
 * Create one with `createHandle()` and pass it to the `handle` prop of the root and of the triggers rendered
 * outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted.
 */
export class DrawerHandle {
  /** the store of the root using this handle, on the client */
  readonly store: ShallowRef<DrawerStore | null> = shallowRef(null);

  /**
   * Opens the drawer, optionally associating it with the trigger of the given id.
   */
  open(triggerId: string | null = null) {
    this.store.value?.setOpen(true, triggerId ? "trigger-press" : "imperative-action", triggerId);
  }

  /** Closes the drawer. */
  close() {
    this.store.value?.setOpen(false, "imperative-action");
  }

  /** Whether the drawer is open. `false` while no root is attached to the handle. */
  get isOpen(): boolean {
    return this.store.value?.open.value ?? false;
  }
}

/** Creates a new handle to connect a `Drawer.Root` with detached `Drawer.Trigger` components. */
export function createHandle(): DrawerHandle {
  return new DrawerHandle();
}

/** the attributes of `open` and `transitionStatus` on a popup, a backdrop and a viewport */
export function popupStateAttributes(open: boolean, transitionStatus: TransitionStatus) {
  return {
    "data-open": open ? "" : undefined,
    "data-closed": open ? undefined : "",
    "data-starting-style": transitionStatus === "starting" ? "" : undefined,
    "data-ending-style": transitionStatus === "ending" ? "" : undefined,
  };
}

// the CSS variables of Base UI
export const DrawerCssVars = {
  swipeMovementX: "--drawer-swipe-movement-x",
  swipeMovementY: "--drawer-swipe-movement-y",
  swipeStrength: "--drawer-swipe-strength",
  swipeProgress: "--drawer-swipe-progress",
  height: "--drawer-height",
  frontmostHeight: "--drawer-frontmost-height",
  nestedDrawers: "--nested-drawers",
  snapPointOffset: "--drawer-snap-point-offset",
} as const;

export const DRAWER_CONTENT_ATTRIBUTE = "data-drawer-content";
export const SWIPE_IGNORE_ATTRIBUTE = "data-base-ui-swipe-ignore";
export const SWIPING_ATTRIBUTE = "data-swiping";
export const SWIPE_DISMISS_ATTRIBUTE = "data-swipe-dismiss";
export const ENDING_STYLE_ATTRIBUTE = "data-ending-style";

let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of the high-frequency swipe variables, which reduces style recalculation in deep subtrees.
 */
export function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) return;
  if (typeof CSS !== "undefined" && "registerProperty" in CSS) {
    for (const name of [
      DrawerCssVars.swipeMovementX,
      DrawerCssVars.swipeMovementY,
      DrawerCssVars.snapPointOffset,
    ]) {
      try {
        CSS.registerProperty({ name, syntax: "<length>", inherits: false, initialValue: "0px" });
      } catch {
        // already registered
      }
    }
    for (const { name, initialValue } of [
      { name: DrawerCssVars.swipeProgress, initialValue: "0" },
      { name: DrawerCssVars.swipeStrength, initialValue: "1" },
    ]) {
      try {
        CSS.registerProperty({ name, syntax: "<number>", inherits: false, initialValue });
      } catch {
        // already registered
      }
    }
  }
  drawerSwipeVarsRegistered = true;
}

/**
 * Runs `fn` once the finite animations and transitions of `element` have finished, like `useAnimationsFinished`
 * of Base UI.
 */
export function runOnceAnimationsFinish(
  element: HTMLElement | null,
  fn: () => void,
  signal: AbortSignal,
) {
  if (!element || typeof element.getAnimations !== "function") {
    fn();
    return;
  }

  const finite = () =>
    element.getAnimations().filter((animation) => {
      const timing = animation.effect?.getTiming();
      return timing?.duration !== Infinity && timing?.iterations !== Infinity;
    });

  function exec() {
    Promise.all(finite().map((animation) => animation.finished.then(() => {}))).then(
      () => {
        if (!signal.aborted) fn();
      },
      () => {
        if (signal.aborted) return;
        // an animation is canceled when a property it depends on changes, wait for the ones replacing it
        if (finite().some((a) => a.pending || a.playState !== "finished")) {
          exec();
          return;
        }
        fn();
      },
    );
  }

  const frame = requestAnimationFrame(exec);
  signal.addEventListener("abort", () => cancelAnimationFrame(frame), { once: true });
}
