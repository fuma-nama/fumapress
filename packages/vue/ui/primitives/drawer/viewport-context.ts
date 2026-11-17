import { inject, provide, type InjectionKey, type Ref } from "vue";

// the swipe state of `Drawer.Viewport`, for its popup
const SwipingKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol.for("drawer-viewport-swiping");

export function provideSwiping(swiping: Readonly<Ref<boolean>>) {
  provide(SwipingKey, swiping);
}

export function injectSwiping(): Readonly<Ref<boolean>> | null {
  return inject(SwipingKey, null);
}
