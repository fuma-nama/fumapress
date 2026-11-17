// The Drawer of Base UI (`@base-ui/react/drawer`), which Reka UI lacks: the parts are named like `Drawer.*` of Base
// UI, import the module as a namespace (`import * as Drawer from ".../primitives/drawer"`).
//
// Covered: a root with a detached handle and a swipe direction, trigger, portal, backdrop, viewport, popup, content,
// title and close, with the state attributes, CSS variables, focus trap, dismissal, scroll lock and swipe of Base UI.
// Not covered: snap points, nested drawers, `Drawer.Provider`/`Indent`, `SwipeArea`, `Description`,
// `VirtualKeyboardProvider`, controlled `open`, payloads and `keepMounted`.
export { default as Root } from "./DrawerRoot.vue";
export { default as Trigger } from "./DrawerTrigger.vue";
export { default as Portal } from "./DrawerPortal.vue";
export { default as Backdrop } from "./DrawerBackdrop.vue";
export { default as Viewport } from "./DrawerViewport.vue";
export { default as Popup } from "./DrawerPopup.vue";
export { default as Content } from "./DrawerContent.vue";
export { default as Title } from "./DrawerTitle.vue";
export { default as Close } from "./DrawerClose.vue";
export {
  createHandle,
  DrawerHandle as Handle,
  type DrawerRootProps as RootProps,
  type DrawerTitleProps as TitleProps,
  type DrawerTriggerProps as TriggerProps,
  type OpenChangeReason,
  type SwipeDirection,
} from "./context";
