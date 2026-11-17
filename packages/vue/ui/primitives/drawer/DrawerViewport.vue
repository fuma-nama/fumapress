<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import {
  DRAWER_CONTENT_ATTRIBUTE,
  DrawerCssVars,
  ENDING_STYLE_ATTRIBUTE,
  SWIPE_DISMISS_ATTRIBUTE,
  SWIPE_IGNORE_ATTRIBUTE,
  SWIPING_ATTRIBUTE,
  popupStateAttributes,
  useDrawerRootContext,
  type SwipeDirection,
} from "./context";
import {
  clamp,
  closest,
  contains,
  findScrollableTouchTarget,
  getDisplacement,
  getElementAtPoint,
  isElement,
  useSwipeDismiss,
  type ScrollAxis,
} from "./swipe";
import { provideSwiping } from "./viewport-context";

/**
 * A positioning container for the popup, renders a `<div>` element. It handles the swipe to dismiss the drawer, and
 * the touch scrolling while it is open.
 */
const MIN_SWIPE_THRESHOLD = 10;
const FAST_SWIPE_VELOCITY = 0.5;
const MIN_SWIPE_RELEASE_VELOCITY = 0.2;
const MAX_SWIPE_RELEASE_VELOCITY = 4;
const MIN_SWIPE_RELEASE_DURATION_MS = 80;
const MAX_SWIPE_RELEASE_DURATION_MS = 360;
const MIN_SWIPE_RELEASE_SCALAR = 0.1;
const MAX_SWIPE_RELEASE_SCALAR = 1;
const AXIS_LOCK_SLOP = 6;
const AXIS_LOCK_BIAS = 2;
const SWIPE_IGNORE_SELECTOR = `[${SWIPE_IGNORE_ATTRIBUTE}]`;
const DRAWER_CONTENT_SELECTOR = `[${DRAWER_CONTENT_ATTRIBUTE}]`;
const AXIS_SWIPE_IGNORE_SELECTORS: Record<ScrollAxis, string> = {
  horizontal: `[${SWIPE_IGNORE_ATTRIBUTE}="x"]`,
  vertical: `[${SWIPE_IGNORE_ATTRIBUTE}="y"]`,
};

interface TouchScrollState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedInPopup: boolean;
  scrollTarget: Element | null;
  hasCrossAxisGestureTarget: boolean;
  allowSwipe: boolean | null;
  preserveNativeCrossAxisScroll: boolean;
  drawerAxisAttributed: boolean;
}

const {
  open,
  mounted,
  transitionStatus,
  swipeDirection,
  popupElement,
  backdropElement,
  viewportElement,
  popupHeight,
  setOpen,
} = useDrawerRootContext();
const element = useTemplateRef<HTMLElement>("element");

const scrollAxis = computed<ScrollAxis>(() =>
  swipeDirection.value === "left" || swipeDirection.value === "right" ? "horizontal" : "vertical",
);
const crossScrollAxis = computed<ScrollAxis>(() =>
  scrollAxis.value === "vertical" ? "horizontal" : "vertical",
);
const stateAttributes = computed(() => popupStateAttributes(open.value, transitionStatus.value));
const style = computed(() => ({ pointerEvents: open.value ? undefined : ("none" as const) }));

function setSwipeDismissed(dismissed: boolean) {
  popupElement.value?.toggleAttribute(SWIPE_DISMISS_ATTRIBUTE, dismissed);
  backdropElement.value?.toggleAttribute(SWIPE_DISMISS_ATTRIBUTE, dismissed);
}

function setSwipeStrength(strength: number | null) {
  popupElement.value?.style.setProperty(
    DrawerCssVars.swipeStrength,
    typeof strength === "number" && Number.isFinite(strength) && strength > 0 ? `${strength}` : "1",
  );
}

function clearSwipeRelease() {
  setSwipeDismissed(false);
  popupElement.value?.removeAttribute(ENDING_STYLE_ATTRIBUTE);
  setSwipeStrength(null);
}

function applySwipeProgress(progress: number) {
  const swipeProgress = open.value ? progress : 0;
  const backdrop = backdropElement.value;
  if (!backdrop) return;
  const showProgress = open.value && swipeProgress > 0;
  backdrop.style.setProperty(DrawerCssVars.swipeProgress, showProgress ? `${swipeProgress}` : "0");
  if (showProgress && popupHeight.value > 0) {
    backdrop.style.setProperty(DrawerCssVars.height, `${popupHeight.value}px`);
  } else {
    backdrop.style.removeProperty(DrawerCssVars.height);
  }
}

// the duration of the closing transition after a release, as a scalar of `--drawer-swipe-strength`
function resolveSwipeRelease(
  popup: HTMLElement,
  direction: SwipeDirection,
  deltaX: number,
  deltaY: number,
  velocityX: number,
  velocityY: number,
  releaseVelocityX: number,
  releaseVelocityY: number,
) {
  const size = getBaseSwipeSize(popup, direction);
  if (size <= 0) return null;
  const remainingDistance = Math.max(0, size - getDisplacement(direction, deltaX, deltaY));
  if (remainingDistance <= 0) return null;
  const releaseVelocity = getDisplacement(direction, releaseVelocityX, releaseVelocityY);
  const directionalVelocity =
    Math.abs(releaseVelocity) > 0
      ? releaseVelocity
      : getDisplacement(direction, velocityX, velocityY);
  if (directionalVelocity <= MIN_SWIPE_RELEASE_VELOCITY) return null;
  const clampedVelocity = clamp(
    directionalVelocity,
    MIN_SWIPE_RELEASE_VELOCITY,
    MAX_SWIPE_RELEASE_VELOCITY,
  );
  const durationMs = clamp(
    remainingDistance / clampedVelocity,
    MIN_SWIPE_RELEASE_DURATION_MS,
    MAX_SWIPE_RELEASE_DURATION_MS,
  );
  const normalizedDuration =
    (durationMs - MIN_SWIPE_RELEASE_DURATION_MS) /
    (MAX_SWIPE_RELEASE_DURATION_MS - MIN_SWIPE_RELEASE_DURATION_MS);
  return (
    MIN_SWIPE_RELEASE_SCALAR +
    normalizedDuration * (MAX_SWIPE_RELEASE_SCALAR - MIN_SWIPE_RELEASE_SCALAR)
  );
}

let touchScrollState: TouchScrollState | null = null;
let ignoreTouchSwipe = false;
let lastPointerType = "";
let ignoreNextTouchStartFromPen = false;

const swipe = useSwipeDismiss({
  enabled: () => mounted.value,
  directions: () => [swipeDirection.value],
  element: () => popupElement.value,
  ignoreSelectorWhenTouch: false,
  ignoreScrollableAncestors: true,
  movementCssVars: { x: DrawerCssVars.swipeMovementX, y: DrawerCssVars.swipeMovementY },
  onSwipeStart(event) {
    if ("touches" in event || (event as PointerEvent).pointerType === "touch") return;
    // a text selection in the popup would follow the pointer
    const popup = popupElement.value;
    const selection = document.getSelection?.();
    if (!popup || !selection || selection.isCollapsed) return;
    const anchor = isElement(selection.anchorNode)
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;
    const focus = isElement(selection.focusNode)
      ? selection.focusNode
      : selection.focusNode?.parentElement;
    if (!contains(popup, anchor) && !contains(popup, focus)) return;
    selection.removeAllRanges();
  },
  onSwipingChange(swiping) {
    backdropElement.value?.toggleAttribute(SWIPING_ATTRIBUTE, swiping);
  },
  swipeThreshold: ({ element, direction }) => getBaseSwipeThreshold(element, direction),
  canStart(position, details) {
    const popup = popupElement.value;
    if (!popup) return false;
    const nativeEvent = details.nativeEvent as PointerEvent | TouchEvent;
    const touchLike = "touches" in nativeEvent || nativeEvent.pointerType === "touch";
    const touchState = touchLike ? touchScrollState : null;
    const elementAtPoint = getElementAtPoint(popup.getRootNode(), position.x, position.y);
    // Activation can be deferred until after a touch that started inside has left the popup.
    if (!touchState?.startedInPopup && !contains(popup, elementAtPoint)) return false;
    if (touchLike && shouldIgnoreSwipeForTextSelection(popup)) return false;
    // Over a cross-axis gesture target, stay pending until the drawer axis wins the gesture.
    if (
      touchState?.hasCrossAxisGestureTarget &&
      !touchState.drawerAxisAttributed &&
      touchState.allowSwipe !== true
    ) {
      return false;
    }
    return true;
  },
  onProgress(progress) {
    applySwipeProgress(progress);
  },
  onRelease({
    deltaX,
    deltaY,
    direction,
    velocityX,
    velocityY,
    releaseVelocityX,
    releaseVelocityY,
  }) {
    const popup = popupElement.value;
    if (!popup) {
      clearSwipeRelease();
      return undefined;
    }
    const startSwipeRelease = (resolvedDirection: SwipeDirection) => {
      // start the ending styles now, so the popup doesn't look stuck before the closing transition
      setSwipeDismissed(true);
      popup.style.removeProperty("transition");
      popup.setAttribute(ENDING_STYLE_ATTRIBUTE, "");
      setSwipeStrength(
        resolveSwipeRelease(
          popup,
          resolvedDirection,
          deltaX,
          deltaY,
          velocityX,
          velocityY,
          releaseVelocityX,
          releaseVelocityY,
        ),
      );
    };

    if (!direction) {
      clearSwipeRelease();
      return undefined;
    }
    const directionalDelta = getDisplacement(direction, deltaX, deltaY);
    if (directionalDelta <= 0) {
      clearSwipeRelease();
      return false;
    }
    if (getDisplacement(direction, velocityX, velocityY) >= FAST_SWIPE_VELOCITY) {
      startSwipeRelease(direction);
      return true;
    }
    const shouldClose = directionalDelta > getBaseSwipeThreshold(popup, direction);
    if (shouldClose) startSwipeRelease(direction);
    else clearSwipeRelease();
    return shouldClose;
  },
  onDismiss() {
    const backdrop = backdropElement.value;
    if (backdrop) {
      backdrop.style.setProperty(DrawerCssVars.swipeProgress, "0");
      backdrop.style.removeProperty(DrawerCssVars.height);
    }
    setOpen(false, "swipe");
    setSwipeDismissed(true);
  },
});
provideSwiping(swipe.swiping);

function resetTouchSwipeState(ignoreSwipe: boolean) {
  ignoreTouchSwipe = ignoreSwipe;
  touchScrollState = null;
}

function resetTouchTrackingState() {
  resetTouchSwipeState(false);
  lastPointerType = "";
  ignoreNextTouchStartFromPen = false;
}

function onPointerDown(event: PointerEvent) {
  lastPointerType = event.pointerType;
  ignoreNextTouchStartFromPen = event.pointerType === "pen";
  if (!open.value || !mounted.value) return;
  const currentTarget = event.currentTarget as HTMLElement;
  const elementAtPoint = getElementAtPoint(
    currentTarget.getRootNode(),
    event.clientX,
    event.clientY,
  );
  // A pointer drag captures the pointer on press, so it can't wait to see which axis the gesture takes.
  if (
    closest(elementAtPoint, SWIPE_IGNORE_SELECTOR) ||
    closest(elementAtPoint, DRAWER_CONTENT_SELECTOR)
  )
    return;
  if (event.pointerType === "touch") return;
  swipe.handleStart({ event, currentTarget });
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  swipe.handleMove({ event, currentTarget: event.currentTarget as HTMLElement });
}

function onPointerEnd(event: PointerEvent) {
  lastPointerType = "";
  if (event.pointerType === "touch") return;
  swipe.handleEnd({ event, currentTarget: event.currentTarget as HTMLElement });
}

function onTouchStart(event: TouchEvent) {
  if (lastPointerType === "pen" && ignoreNextTouchStartFromPen) {
    ignoreNextTouchStartFromPen = false;
    resetTouchSwipeState(false);
    return;
  }
  if (!open.value || !mounted.value) {
    resetTouchSwipeState(false);
    return;
  }
  const touch = event.touches[0];
  if (!touch) return;
  if (event.composedPath().some((t) => t instanceof HTMLInputElement && t.type === "range")) {
    resetTouchSwipeState(false);
    return;
  }
  const root = event.currentTarget as HTMLElement;
  const elementAtPoint = getElementAtPoint(root.getRootNode(), touch.clientX, touch.clientY);
  const target = isElement(event.target) ? event.target : root;
  if (!contains(root, target)) {
    resetTouchSwipeState(true);
    return;
  }
  // `x`/`y` hand the touch drags along that axis to the element, any other value ignores the swipe
  if (
    closest(
      elementAtPoint,
      `${SWIPE_IGNORE_SELECTOR}:not(${AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis.value]})`,
    )
  ) {
    resetTouchSwipeState(true);
    return;
  }
  ignoreTouchSwipe = false;
  const scrollTarget = findScrollableTouchTarget(target, root, scrollAxis.value);
  const hasCrossAxisGestureTarget =
    findScrollableTouchTarget(target, root, crossScrollAxis.value) != null ||
    closest(elementAtPoint, AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis.value]) != null;
  let allowSwipe: boolean | null = null;
  if (scrollTarget) {
    allowSwipe = isAtSwipeStartEdge(scrollTarget, scrollAxis.value, swipeDirection.value)
      ? null
      : false;
  }
  touchScrollState = {
    startX: touch.clientX,
    startY: touch.clientY,
    lastX: touch.clientX,
    lastY: touch.clientY,
    startedInPopup: contains(popupElement.value, elementAtPoint),
    scrollTarget,
    hasCrossAxisGestureTarget,
    allowSwipe,
    preserveNativeCrossAxisScroll: false,
    drawerAxisAttributed: false,
  };
  swipe.handleStart({ event, currentTarget: root });
}

function onTouchEnd(event: TouchEvent) {
  resetTouchTrackingState();
  swipe.handleEnd({ event, currentTarget: event.currentTarget as HTMLElement });
}

function processTouchMove(
  event: TouchEvent,
  touchState: TouchScrollState,
  touch: Touch,
  root: HTMLElement,
) {
  const isVertical = scrollAxis.value === "vertical";
  const drawerAxisDelta = isVertical
    ? touch.clientY - touchState.lastY
    : touch.clientX - touchState.lastX;
  // Avoid blocking pinch zoom or text selection adjustments on iOS Safari.
  if (event.touches.length === 2) return;
  if (shouldIgnoreSwipeForTextSelection(root)) return;
  if (shouldYieldTouchMove(touchState, event, touch, isVertical)) return;

  const scrollTarget = touchState.scrollTarget;
  if (
    !scrollTarget ||
    scrollTarget === document.documentElement ||
    scrollTarget === document.body
  ) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    swipe.handleMove({ event, currentTarget: root });
    return;
  }
  if (!hasScrollableContentOnAxis(scrollTarget, scrollAxis.value)) {
    // The scroll container doesn't overflow on the drawer axis: prevent the window from scrolling instead.
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (drawerAxisDelta !== 0) {
    const canSwipeFromScrollEdge = canSwipeFromScrollEdgeOnMove(
      scrollTarget,
      scrollAxis.value,
      swipeDirection.value,
      drawerAxisDelta,
    );
    if (!touchState.allowSwipe) {
      if (event.cancelable && canSwipeFromScrollEdge) {
        touchState.allowSwipe = true;
        event.preventDefault();
      } else {
        touchState.allowSwipe = false;
      }
    } else if (event.cancelable) {
      event.preventDefault();
    }
  }
  if (touchState.allowSwipe === true) {
    event.stopPropagation();
    swipe.handleMove({ event, currentTarget: root });
  }
}

onMounted(() => {
  viewportElement.value = element.value;

  // reopening while the popup is still mounted
  watch(
    open,
    (value) => {
      if (!value) return;
      swipe.reset();
      clearSwipeRelease();
    },
    { flush: "post" },
  );

  // A non-passive document listener makes all touch scrolling wait on the main thread: only while open.
  watch(
    open,
    (value, _, onCleanup) => {
      const root = element.value ?? popupElement.value;
      if (!value || !root) return;
      const onTouchMove = (event: TouchEvent) => {
        if (ignoreTouchSwipe) return;
        const touchState = touchScrollState;
        const touch = event.touches[0];
        if (!touch || !touchState) return;
        processTouchMove(event, touchState, touch, root);
        touchState.lastX = touch.clientX;
        touchState.lastY = touch.clientY;
      };
      document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
      onCleanup(() => document.removeEventListener("touchmove", onTouchMove, { capture: true }));
    },
    { immediate: true },
  );
});

onBeforeUnmount(() => {
  backdropElement.value?.toggleAttribute(SWIPING_ATTRIBUTE, false);
  if (viewportElement.value === element.value) viewportElement.value = null;
});

function getBaseSwipeSize(element: HTMLElement, direction: SwipeDirection) {
  return direction === "left" || direction === "right" ? element.offsetWidth : element.offsetHeight;
}

function getBaseSwipeThreshold(element: HTMLElement, direction: SwipeDirection) {
  return Math.max(getBaseSwipeSize(element, direction) * 0.5, MIN_SWIPE_THRESHOLD);
}

function shouldIgnoreSwipeForTextSelection(root: Element) {
  const active = document.activeElement;
  if (
    active &&
    contains(root, active) &&
    (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
  ) {
    const { selectionStart, selectionEnd } = active;
    if (selectionStart != null && selectionEnd != null && selectionStart < selectionEnd)
      return true;
  }
  const selection = document.getSelection?.();
  if (!selection || selection.isCollapsed) return false;
  const anchor = isElement(selection.anchorNode)
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const focus = isElement(selection.focusNode)
    ? selection.focusNode
    : selection.focusNode?.parentElement;
  return selection.containsNode(root, true) || contains(root, anchor) || contains(root, focus);
}

/**
 * Arbitrates a touchmove between the drawer swipe and a cross-axis gesture. Returns `true` when the move is left
 * alone: the cross axis won the gesture, or neither axis passed the slop yet.
 */
function shouldYieldTouchMove(
  touchState: TouchScrollState,
  event: TouchEvent,
  touch: Touch,
  isVertical: boolean,
) {
  if (touchState.preserveNativeCrossAxisScroll) return true;
  if (
    touchState.drawerAxisAttributed ||
    touchState.allowSwipe === true ||
    !touchState.hasCrossAxisGestureTarget
  ) {
    return false;
  }
  // The browser has already committed the gesture to a native scroll.
  if (!event.cancelable) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }
  const drawerAxisDelta = isVertical
    ? touch.clientY - touchState.startY
    : touch.clientX - touchState.startX;
  const crossAxisDelta = isVertical
    ? touch.clientX - touchState.startX
    : touch.clientY - touchState.startY;
  if (
    Math.abs(crossAxisDelta) >= AXIS_LOCK_SLOP &&
    Math.abs(crossAxisDelta) > Math.abs(drawerAxisDelta) + AXIS_LOCK_BIAS
  ) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }
  if (Math.abs(drawerAxisDelta) >= AXIS_LOCK_SLOP) {
    touchState.drawerAxisAttributed = true;
    return false;
  }
  return true;
}

function getScrollMetrics(scrollTarget: Element, axis: ScrollAxis) {
  if (axis === "vertical") {
    return {
      offset: scrollTarget.scrollTop,
      max: Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight),
    };
  }
  return {
    offset: scrollTarget.scrollLeft,
    max: Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth),
  };
}

function hasScrollableContentOnAxis(scrollTarget: Element, axis: ScrollAxis) {
  return getScrollMetrics(scrollTarget, axis).max > 0;
}

function shouldDismissFromStartEdge(direction: SwipeDirection, axis: ScrollAxis) {
  return axis === "vertical" ? direction === "down" : direction === "right";
}

function isAtSwipeStartEdge(scrollTarget: Element, axis: ScrollAxis, direction: SwipeDirection) {
  const { offset, max } = getScrollMetrics(scrollTarget, axis);
  return shouldDismissFromStartEdge(direction, axis) ? offset <= 0 : offset >= max;
}

function canSwipeFromScrollEdgeOnMove(
  scrollTarget: Element,
  axis: ScrollAxis,
  direction: SwipeDirection,
  delta: number,
) {
  const fromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const movingTowardDismiss = fromStartEdge ? delta > 0 : delta < 0;
  if (!movingTowardDismiss) return false;
  return isAtSwipeStartEdge(scrollTarget, axis, direction);
}
</script>

<template>
  <div
    ref="element"
    role="presentation"
    :hidden="!mounted"
    :style="style"
    v-bind="stateAttributes"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <slot />
  </div>
</template>
