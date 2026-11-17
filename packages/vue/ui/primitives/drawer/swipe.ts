import { shallowRef, type Ref } from "vue";
import type { SwipeDirection } from "./context";

// A port of `useSwipeDismiss` of Base UI (`utils/useSwipeDismiss`), with the scroll helpers it relies on.

export type ScrollAxis = "horizontal" | "vertical";

const DEFAULT_SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const MIN_VELOCITY_DURATION_MS = 50;
// Under one frame at 240 Hz, so it only damps near-simultaneous samples.
const MIN_RELEASE_VELOCITY_DURATION_MS = 4;
const MAX_RELEASE_VELOCITY_AGE_MS = 80;
const MIN_VELOCITY_SAMPLE_DISTANCE = 1;
const DEFAULT_IGNORE_SELECTOR = 'button,a,input,select,textarea,label,[role="button"]';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function getDisplacement(
  direction: SwipeDirection | undefined,
  deltaX: number,
  deltaY: number,
) {
  switch (direction) {
    case "up":
      return -deltaY;
    case "down":
      return deltaY;
    case "left":
      return -deltaX;
    case "right":
      return deltaX;
    default:
      return 0;
  }
}

export function isElement(value: unknown): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

export function contains(parent: Element | null | undefined, child: Element | null | undefined) {
  if (!parent || !child) return false;
  return parent.contains(child);
}

export function closest(element: Element | null | undefined, selector: string) {
  return element?.closest(selector) ?? null;
}

export function getElementAtPoint(
  root: Node | null | undefined,
  x: number,
  y: number,
): Element | null {
  const target = root as
    | (Node & { elementFromPoint?: (x: number, y: number) => Element | null })
    | null;
  return typeof target?.elementFromPoint === "function" ? target.elementFromPoint(x, y) : null;
}

function getParentNode(node: Node): Node {
  if (node.nodeName.toLowerCase() === "html") return node;
  return (
    (node as Element).assignedSlot ??
    node.parentNode ??
    ((node as ShadowRoot).host as Node | undefined) ??
    (node.ownerDocument ?? document).documentElement
  );
}

function isLastTraversableNode(node: Node) {
  return ["html", "body", "#document"].includes(node.nodeName.toLowerCase());
}

export function isScrollable(element: Element, axis: ScrollAxis) {
  const style = getComputedStyle(element);
  if (axis === "vertical") {
    if (style.overflowY !== "auto" && style.overflowY !== "scroll") return false;
    return element.scrollHeight > element.clientHeight;
  }
  if (style.overflowX !== "auto" && style.overflowX !== "scroll") return false;
  return element.scrollWidth > element.clientWidth;
}

export function findScrollableAncestor(target: Element | null, root: Element, axis: ScrollAxis) {
  let node: Node | null = target;
  while (isElement(node) && node !== root && !isLastTraversableNode(node)) {
    if (node instanceof HTMLElement && isScrollable(node, axis)) return node;
    node = getParentNode(node);
  }
  return null;
}

export function findScrollableTouchTarget(
  target: Element | null,
  root: Element,
  axis: ScrollAxis = "vertical",
) {
  return findScrollableAncestor(target, root, axis) ?? (isScrollable(root, axis) ? root : null);
}

/** the 2D translation and scale of the computed `transform` of an element */
function getElementTransform(element: Element) {
  const transform = getComputedStyle(element).transform;
  let x = 0;
  let y = 0;
  let scale = 1;
  if (transform && transform !== "none") {
    const matrix = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (matrix?.[1]) {
      const values = matrix[1].split(", ").map(parseFloat);
      if (values.length === 6) {
        x = values[4]!;
        y = values[5]!;
        scale = Math.sqrt(values[0]! * values[0]! + values[1]! * values[1]!);
      } else if (values.length === 16) {
        x = values[12]!;
        y = values[13]!;
        scale = values[0]!;
      }
    }
  }
  return { x, y, scale };
}

function getValidTimeStamp(timeStamp: number) {
  return Number.isFinite(timeStamp) && timeStamp > 0 ? timeStamp : null;
}

function getDragTransform(offset: { x: number; y: number }, scale: number) {
  return `translate3d(${offset.x}px,${offset.y}px,0) scale(${scale})`;
}

function hasPrimaryMouseButton(buttons: number) {
  return buttons % 2 === 1;
}

function changePointerCapture(
  element: Element,
  pointerId: number,
  method: "setPointerCapture" | "releasePointerCapture",
) {
  if (typeof element[method] !== "function") return;
  try {
    element[method](pointerId);
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "NotFoundError")
      return;
    throw error;
  }
}

/** a pointer or touch event, with the element that handles it */
export interface SwipeEvent {
  event: PointerEvent | TouchEvent;
  currentTarget: Element;
}

export interface SwipeProgressDetails {
  deltaX: number;
  deltaY: number;
  direction: SwipeDirection | undefined;
}

export interface SwipeReleaseDetails {
  event: Event;
  direction: SwipeDirection | undefined;
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityY: number;
  releaseVelocityX: number;
  releaseVelocityY: number;
}

export interface UseSwipeDismissOptions {
  enabled: () => boolean;
  directions: () => SwipeDirection[];
  element: () => HTMLElement | null;
  movementCssVars: { x: string; y: string };
  canStart?: (
    position: { x: number; y: number },
    details: { nativeEvent: Event; direction: SwipeDirection | undefined },
  ) => boolean;
  ignoreSelectorWhenTouch?: boolean;
  ignoreScrollableAncestors?: boolean;
  swipeThreshold?:
    | number
    | ((details: { element: HTMLElement; direction: SwipeDirection }) => number);
  onDismiss?: (event: Event, details: { direction: SwipeDirection }) => void;
  onProgress?: (progress: number, details?: SwipeProgressDetails) => void;
  onCancel?: (event: Event) => void;
  onSwipeStart?: (event: Event) => void;
  onRelease?: (details: SwipeReleaseDetails) => boolean | undefined;
  onSwipingChange?: (swiping: boolean) => void;
}

function isTouch(event: PointerEvent | TouchEvent): event is TouchEvent {
  return "touches" in event;
}

function isTouchLike(event: PointerEvent | TouchEvent) {
  return isTouch(event) || event.pointerType === "touch";
}

function getPrimaryPointerPosition(event: PointerEvent | TouchEvent) {
  if (isTouch(event)) {
    const touch = event.touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

export function useSwipeDismiss(options: UseSwipeDismissOptions) {
  const {
    movementCssVars,
    canStart,
    ignoreSelectorWhenTouch = true,
    ignoreScrollableAncestors = false,
    swipeThreshold: swipeThresholdProp,
    onDismiss,
    onProgress,
    onCancel,
    onSwipeStart,
    onRelease,
    onSwipingChange,
  } = options;
  const ignoreSelector = DEFAULT_IGNORE_SELECTOR;
  const swipeThresholdDefault = Math.max(
    0,
    typeof swipeThresholdProp === "number" ? swipeThresholdProp : DEFAULT_SWIPE_THRESHOLD,
  );

  function axes() {
    const directions = options.directions();
    const allowLeft = directions.includes("left");
    const allowRight = directions.includes("right");
    const allowUp = directions.includes("up");
    const allowDown = directions.includes("down");
    const hasHorizontal = allowLeft || allowRight;
    return {
      directions,
      primaryDirection: directions.length === 1 ? directions[0] : undefined,
      allowLeft,
      allowRight,
      allowUp,
      allowDown,
      hasHorizontal,
      hasVertical: allowUp || allowDown,
      // Consumers only pass directions on a single axis.
      scrollAxis: (hasHorizontal ? "horizontal" : "vertical") as ScrollAxis,
    };
  }

  const swiping = shallowRef(false);
  let dragStartPos = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let lastMovePos: { x: number; y: number } | null = null;
  let initialTransform = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: SwipeDirection | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  let pendingSwipe = false;
  let pendingSwipeStartPos: { x: number; y: number } | null = null;
  let swipeFromScrollable = false;
  let sawPrimaryButtonsOnMove = false;
  let elementSize = { width: 0, height: 0 };
  let swipeProgress = 0;
  let swipeThreshold = swipeThresholdDefault;
  let swipeThresholdFunction:
    | ((details: { element: HTMLElement; direction: SwipeDirection }) => number)
    | null = null;
  let swipeStartTime: number | null = null;
  let lastDragSample: { x: number; y: number; time: number } | null = null;
  let hasStationarySample = false;
  let lastDragVelocity = { x: 0, y: 0 };
  let lastProgressDetails: SwipeProgressDetails | null = null;
  let isSwiping = false;
  let dragStyleSnapshot: [string, string] | null = null;

  function setSwiping(next: boolean) {
    if (isSwiping === next) return;
    isSwiping = next;
    swiping.value = next;
    onSwipingChange?.(next);
  }

  function resolveSwipeThreshold(direction: SwipeDirection | undefined) {
    if (!direction) return;
    const element = options.element();
    if (!element || !swipeThresholdFunction) return;
    swipeThreshold = Math.max(0, swipeThresholdFunction({ element, direction }));
  }

  function updateSwipeProgress(progress: number, details?: SwipeProgressDetails) {
    const nextProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
    const progressChanged = nextProgress !== swipeProgress;
    let detailsChanged = false;
    if (details) {
      const last = lastProgressDetails;
      detailsChanged =
        !last ||
        last.deltaX !== details.deltaX ||
        last.deltaY !== details.deltaY ||
        last.direction !== details.direction;
    }
    if (!progressChanged && !detailsChanged) return;
    swipeProgress = nextProgress;
    if (details) lastProgressDetails = details;
    else if (progressChanged) lastProgressDetails = null;
    onProgress?.(nextProgress, details);
  }

  function syncDragStyles(active: boolean) {
    const element = options.element();
    if (!element) {
      if (!active) dragStyleSnapshot = null;
      return;
    }
    const style = element.style;
    if (active) {
      if (!dragStyleSnapshot) dragStyleSnapshot = [style.transition, style.transform];
      style.transition = "none";
    } else if (dragStyleSnapshot) {
      [style.transition, style.transform] = dragStyleSnapshot;
      dragStyleSnapshot = null;
    }
    const deltaX = dragOffset.x - initialTransform.x;
    const deltaY = dragOffset.y - initialTransform.y;
    if (active) style.transform = getDragTransform(dragOffset, initialTransform.scale);
    style.setProperty(movementCssVars.x, `${deltaX}px`);
    style.setProperty(movementCssVars.y, `${deltaY}px`);
  }

  function recordDragSample(offset: { x: number; y: number }, timeStamp: number | null) {
    if (timeStamp === null) return;
    const lastSample = lastDragSample;
    if (lastSample && timeStamp > lastSample.time) {
      // Some Android devices emit one effectively stationary move immediately before release.
      const stationary =
        Math.abs(offset.x - lastSample.x) < MIN_VELOCITY_SAMPLE_DISTANCE &&
        Math.abs(offset.y - lastSample.y) < MIN_VELOCITY_SAMPLE_DISTANCE;
      const skipSample = stationary && !hasStationarySample;
      hasStationarySample = stationary;
      if (skipSample) return;
      const durationMs = Math.max(timeStamp - lastSample.time, MIN_RELEASE_VELOCITY_DURATION_MS);
      lastDragVelocity = {
        x: (offset.x - lastSample.x) / durationMs,
        y: (offset.y - lastSample.y) / durationMs,
      };
    }
    lastDragSample = { x: offset.x, y: offset.y, time: timeStamp };
  }

  function reset() {
    setSwiping(false);
    updateSwipeProgress(0);
    swipeThreshold = swipeThresholdDefault;
    swipeThresholdFunction = null;
    dragStartPos = { x: 0, y: 0 };
    dragOffset = { x: 0, y: 0 };
    initialTransform = { x: 0, y: 0, scale: 1 };
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    cancelledSwipe = false;
    swipeCancelBaseline = { x: 0, y: 0 };
    isFirstPointerMove = false;
    lastMovePos = null;
    pendingSwipe = false;
    pendingSwipeStartPos = null;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = false;
    elementSize = { width: 0, height: 0 };
    swipeStartTime = null;
    lastDragSample = null;
    hasStationarySample = false;
    lastDragVelocity = { x: 0, y: 0 };
    lastProgressDetails = null;
    syncDragStyles(false);
  }

  function getTargetAtPoint(position: { x: number; y: number }, event: Event) {
    const root = options.element()?.getRootNode();
    const target = getElementAtPoint(root, position.x, position.y);
    return target ?? (isElement(event.target) ? event.target : null);
  }

  function findGestureScrollableTouchTarget(target: Element | null, root: Element) {
    // The swiped element is positioned relative to the viewport, so the page scroller must not gate the gesture.
    const scrollTarget = findScrollableTouchTarget(target, root, axes().scrollAxis);
    const doc = scrollTarget?.ownerDocument ?? document;
    return scrollTarget === doc.body || scrollTarget === doc.documentElement ? null : scrollTarget;
  }

  function startSwipeAtPosition(
    event: PointerEvent | TouchEvent,
    position: { x: number; y: number },
    startOptions?: { ignoreScrollableTarget?: boolean; ignoreScrollableAncestors?: boolean },
  ) {
    swipeFromScrollable = false;
    const touchLike = isTouchLike(event);
    const target = getTargetAtPoint(position, event);
    const element = options.element();
    const body = (element?.ownerDocument ?? document).body;
    const scrollableTarget =
      touchLike && body ? findGestureScrollableTouchTarget(target, body) : null;
    const ignoreScrollableTarget = startOptions?.ignoreScrollableTarget ?? false;
    if (scrollableTarget && !ignoreScrollableTarget) return false;
    swipeFromScrollable = Boolean(scrollableTarget && ignoreScrollableTarget);

    const isInteractiveElement = closest(target, ignoreSelector);
    if (isInteractiveElement && (!touchLike || ignoreSelectorWhenTouch)) return false;

    if (ignoreScrollableAncestors && element && target) {
      const ignoreAncestors = startOptions?.ignoreScrollableAncestors ?? false;
      if (!ignoreAncestors && findScrollableAncestor(target, element, axes().scrollAxis) != null) {
        return false;
      }
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    dragStartPos = position;
    swipeStartTime = getValidTimeStamp(event.timeStamp);
    lastDragSample = null;
    hasStationarySample = false;
    lastDragVelocity = { x: 0, y: 0 };
    swipeCancelBaseline = position;
    lastMovePos = position;
    swipeThreshold = swipeThresholdDefault;
    swipeThresholdFunction = typeof swipeThresholdProp === "function" ? swipeThresholdProp : null;
    if (element) {
      elementSize = { width: element.offsetWidth, height: element.offsetHeight };
      resolveSwipeThreshold(axes().primaryDirection);
      const transform = getElementTransform(element);
      initialTransform = transform;
      dragOffset = { x: transform.x, y: transform.y };
      recordDragSample({ x: transform.x, y: transform.y }, swipeStartTime);
      if (!isTouch(event)) changePointerCapture(element, event.pointerId, "setPointerCapture");
    }
    onSwipeStart?.(event);
    setSwiping(true);
    isFirstPointerMove = true;
    updateSwipeProgress(0);
    syncDragStyles(true);
    return true;
  }

  function clearPendingSwipeStartState() {
    pendingSwipe = false;
    pendingSwipeStartPos = null;
  }

  function resetPendingSwipeState() {
    clearPendingSwipeStartState();
    swipeFromScrollable = false;
    lastMovePos = null;
  }

  function cancelSwipeInteraction(event: PointerEvent) {
    resetPendingSwipeState();
    if (!isSwiping) return;
    setSwiping(false);
    dragOffset = { x: initialTransform.x, y: initialTransform.y };
    sawPrimaryButtonsOnMove = false;
    syncDragStyles(false);
    const element = options.element();
    if (element) changePointerCapture(element, event.pointerId, "releasePointerCapture");
    updateSwipeProgress(0, { deltaX: 0, deltaY: 0, direction: undefined });
    onCancel?.(event);
  }

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const { allowLeft, allowRight, allowUp, allowDown, hasHorizontal, hasVertical } = axes();
    const exponent = (value: number) => Math.sign(value) * Math.abs(value) ** 0.5;
    const dampAxis = (delta: number, allowNegative: boolean, allowPositive: boolean) => {
      if ((!allowNegative && delta < 0) || (!allowPositive && delta > 0)) return exponent(delta);
      return delta;
    };
    return {
      x: hasHorizontal ? dampAxis(deltaX, allowLeft, allowRight) : exponent(deltaX),
      y: hasVertical ? dampAxis(deltaY, allowUp, allowDown) : exponent(deltaY),
    };
  }

  function canSwipeFromScrollEdgeOnPendingMove(
    scrollTarget: Element,
    deltaX: number,
    deltaY: number,
  ) {
    const { allowLeft, allowRight, allowUp, allowDown, hasHorizontal, hasVertical } = axes();
    // Toward the axis start edge (down/right) when scrolled to the start, toward the end edge when scrolled to the end.
    const canSwipeOnAxis = (
      delta: number,
      scrollOffset: number,
      maxScrollOffset: number,
      allowTowardStart: boolean,
      allowTowardEnd: boolean,
    ) =>
      (delta > 0 && scrollOffset <= 0 && allowTowardStart) ||
      (delta < 0 && scrollOffset >= Math.max(0, maxScrollOffset) && allowTowardEnd);
    if (hasVertical && deltaY !== 0) {
      return canSwipeOnAxis(
        deltaY,
        scrollTarget.scrollTop,
        scrollTarget.scrollHeight - scrollTarget.clientHeight,
        allowDown,
        allowUp,
      );
    }
    if (hasHorizontal && deltaX !== 0) {
      return canSwipeOnAxis(
        deltaX,
        scrollTarget.scrollLeft,
        scrollTarget.scrollWidth - scrollTarget.clientWidth,
        allowRight,
        allowLeft,
      );
    }
    return null;
  }

  function handleStart({ event }: SwipeEvent) {
    if (!options.enabled()) return;
    if (event.defaultPrevented) return;
    if (!isTouch(event) && event.button !== 0) return;
    const startPos = getPrimaryPointerPosition(event);
    if (!startPos) return;
    pendingSwipe = true;
    pendingSwipeStartPos = startPos;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = !isTouch(event);
    const allowedToStart = canStart
      ? canStart(startPos, { nativeEvent: event, direction: axes().primaryDirection })
      : true;
    if (!allowedToStart) return;
    if (startSwipeAtPosition(event, startPos)) clearPendingSwipeStartState();
  }

  function handleMoveCore(
    { event, currentTarget }: SwipeEvent,
    position: { x: number; y: number },
    movement: { x: number; y: number },
  ) {
    if (!options.enabled() || !isSwiping) return;
    const {
      allowLeft,
      allowRight,
      allowUp,
      allowDown,
      hasHorizontal,
      hasVertical,
      primaryDirection,
    } = axes();
    const target = isElement(event.target) ? event.target : null;
    if (isTouchLike(event) && !swipeFromScrollable) {
      if (findGestureScrollableTouchTarget(target, currentTarget)) return;
    }
    // Prevent text selection on Safari
    if (!isTouch(event)) event.preventDefault();

    if (isFirstPointerMove) {
      isFirstPointerMove = false;
      // Reset the drag origin to the first move, which absorbs the gap between the press and the first move.
      dragStartPos = position;
      const moveTime = getValidTimeStamp(event.timeStamp);
      if (moveTime !== null) swipeStartTime = moveTime;
      lastDragSample = null;
      hasStationarySample = false;
    }

    const { x: clientX, y: clientY } = position;
    if (
      (movement.y < 0 && clientY > swipeCancelBaseline.y) ||
      (movement.y > 0 && clientY < swipeCancelBaseline.y)
    ) {
      swipeCancelBaseline = { x: swipeCancelBaseline.x, y: clientY };
    }
    if (
      (movement.x < 0 && clientX > swipeCancelBaseline.x) ||
      (movement.x > 0 && clientX < swipeCancelBaseline.x)
    ) {
      swipeCancelBaseline = { x: clientX, y: swipeCancelBaseline.y };
    }

    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;
    const cancelDeltaY = clientY - swipeCancelBaseline.y;
    const cancelDeltaX = clientX - swipeCancelBaseline.x;
    if (!intendedSwipeDirection) {
      let candidate: SwipeDirection;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) candidate = deltaX > 0 ? "right" : "left";
      else candidate = deltaY > 0 ? "down" : "up";
      const isAllowed =
        (candidate === "left" && allowLeft) ||
        (candidate === "right" && allowRight) ||
        (candidate === "up" && allowUp) ||
        (candidate === "down" && allowDown);
      if (isAllowed) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        resolveSwipeThreshold(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);
      if (currentDisplacement > swipeThreshold) {
        cancelledSwipe = false;
      } else if (
        !(allowLeft && allowRight) &&
        !(allowUp && allowDown) &&
        maxSwipeDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        // a change of mind
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransform.x;
    let newOffsetY = initialTransform.y;
    if (hasHorizontal) newOffsetX += dampedDelta.x;
    if (hasVertical) newOffsetY += dampedDelta.y;

    // Only rewrite drag styles when the drag offset changed.
    const offsetChanged = newOffsetX !== dragOffset.x || newOffsetY !== dragOffset.y;
    dragOffset = { x: newOffsetX, y: newOffsetY };
    if (offsetChanged) syncDragStyles(true);
    recordDragSample({ x: newOffsetX, y: newOffsetY }, getValidTimeStamp(event.timeStamp));

    const dragDeltaX = newOffsetX - initialTransform.x;
    const dragDeltaY = newOffsetY - initialTransform.y;
    let progress = 0;
    const progressDirection = primaryDirection ?? intendedSwipeDirection;
    if (progressDirection) {
      const size =
        progressDirection === "left" || progressDirection === "right"
          ? elementSize.width
          : elementSize.height;
      const scale = initialTransform.scale || 1;
      const displacement = getDisplacement(progressDirection, dragDeltaX, dragDeltaY);
      if (size > 0 && scale > 0 && displacement > 0) progress = displacement / (size * scale);
    }
    updateSwipeProgress(progress, {
      deltaX: dragDeltaX,
      deltaY: dragDeltaY,
      direction: intendedSwipeDirection,
    });
  }

  function handleEnd({ event }: SwipeEvent) {
    if (!options.enabled()) return;
    const releaseDeltaX = dragOffset.x - initialTransform.x;
    const releaseDeltaY = dragOffset.y - initialTransform.y;
    const progressDetails = {
      deltaX: releaseDeltaX,
      deltaY: releaseDeltaY,
      direction: intendedSwipeDirection,
    };
    if (!isSwiping) {
      resetPendingSwipeState();
      updateSwipeProgress(0, progressDetails);
      return;
    }
    setSwiping(false);
    resetPendingSwipeState();
    sawPrimaryButtonsOnMove = false;
    const element = options.element();
    if (element && !isTouch(event))
      changePointerCapture(element, event.pointerId, "releasePointerCapture");

    const deltaX = releaseDeltaX;
    const deltaY = releaseDeltaY;
    const startTime = swipeStartTime;
    const endTime = getValidTimeStamp(event.timeStamp);
    const durationMs =
      startTime !== null && endTime !== null && endTime > startTime ? endTime - startTime : 0;
    const velocityDurationMs = durationMs > 0 ? Math.max(durationMs, MIN_VELOCITY_DURATION_MS) : 0;
    const velocityX = velocityDurationMs > 0 ? deltaX / velocityDurationMs : 0;
    const velocityY = velocityDurationMs > 0 ? deltaY / velocityDurationMs : 0;
    let releaseVelocityX = lastDragVelocity.x;
    let releaseVelocityY = lastDragVelocity.y;
    const lastSample = lastDragSample;
    if (lastSample && endTime !== null && endTime >= lastSample.time) {
      const ageMs = endTime - lastSample.time;
      if (ageMs <= MAX_RELEASE_VELOCITY_AGE_MS) {
        const sampleDurationMs = Math.max(ageMs, MIN_RELEASE_VELOCITY_DURATION_MS);
        const fromLastX = dragOffset.x - lastSample.x;
        const fromLastY = dragOffset.y - lastSample.y;
        if (Math.abs(fromLastX) >= MIN_VELOCITY_SAMPLE_DISTANCE)
          releaseVelocityX = fromLastX / sampleDurationMs;
        if (Math.abs(fromLastY) >= MIN_VELOCITY_SAMPLE_DISTANCE)
          releaseVelocityY = fromLastY / sampleDurationMs;
      } else {
        releaseVelocityX = 0;
        releaseVelocityY = 0;
      }
    }

    const releaseDecision = onRelease?.({
      event,
      direction: intendedSwipeDirection,
      deltaX,
      deltaY,
      velocityX,
      velocityY,
      releaseVelocityX,
      releaseVelocityY,
    });
    const hasReleaseDecision = typeof releaseDecision === "boolean";
    if (cancelledSwipe && !hasReleaseDecision) {
      dragOffset = { x: initialTransform.x, y: initialTransform.y };
      syncDragStyles(false);
      updateSwipeProgress(0, progressDetails);
      return;
    }

    let shouldClose = false;
    let dismissDirection: SwipeDirection | undefined;
    if (hasReleaseDecision) {
      shouldClose = releaseDecision;
      dismissDirection = intendedSwipeDirection ?? axes().primaryDirection;
    } else {
      for (const direction of axes().directions) {
        if (getDisplacement(direction, deltaX, deltaY) > swipeThreshold) {
          shouldClose = true;
          dismissDirection = direction;
          break;
        }
      }
    }

    if (shouldClose && dismissDirection) {
      syncDragStyles(false);
      onDismiss?.(event, { direction: dismissDirection });
    } else {
      dragOffset = { x: initialTransform.x, y: initialTransform.y };
      syncDragStyles(false);
      updateSwipeProgress(0, progressDetails);
    }
  }

  function handleMove(swipeEvent: SwipeEvent) {
    const { event } = swipeEvent;
    const currentPos = getPrimaryPointerPosition(event);
    if (!currentPos) return;
    let endAfterMove = false;
    if (!isTouch(event)) {
      const hasPrimaryButton = hasPrimaryMouseButton(event.buttons);
      if (hasPrimaryButton) sawPrimaryButtonsOnMove = true;
      // Cancel the swipe if a non-primary button takes over the interaction.
      if (event.buttons !== 0 && !hasPrimaryButton) {
        cancelSwipeInteraction(event);
        return;
      }
      // A `buttons: 0` move means the primary button was already released: treat it as the release.
      if (event.buttons === 0 && sawPrimaryButtonsOnMove) {
        if (!isSwiping) {
          handleEnd(swipeEvent);
          return;
        }
        endAfterMove = true;
      }
    }

    if (!isSwiping && pendingSwipe) {
      if (!isTouchLike(event) && event.defaultPrevented) {
        resetPendingSwipeState();
        return;
      }
      const allowedToStart = canStart
        ? canStart(currentPos, { nativeEvent: event, direction: axes().primaryDirection })
        : true;
      if (allowedToStart) {
        const pendingStartPos = pendingSwipeStartPos;
        let ignoreScrollableOnStart = false;
        if (isTouchLike(event)) {
          const element = options.element();
          if (pendingStartPos && element) {
            const target = getTargetAtPoint(currentPos, event);
            const body = element.ownerDocument.body;
            const scrollTarget = body ? findGestureScrollableTouchTarget(target, body) : null;
            if (
              scrollTarget &&
              (contains(element, scrollTarget) || contains(scrollTarget, element))
            ) {
              const canSwipeFromEdge = canSwipeFromScrollEdgeOnPendingMove(
                scrollTarget,
                currentPos.x - pendingStartPos.x,
                currentPos.y - pendingStartPos.y,
              );
              if (canSwipeFromEdge === false) return;
              if (canSwipeFromEdge === true) ignoreScrollableOnStart = true;
            }
          }
        }
        const started = startSwipeAtPosition(event, currentPos, {
          ignoreScrollableTarget: ignoreScrollableOnStart,
          ignoreScrollableAncestors: ignoreScrollableOnStart,
        });
        if (started) {
          if (pendingStartPos && ignoreScrollableOnStart) {
            // Keep the displacement from the press to the move that started the swipe, so quick flicks dismiss.
            clearPendingSwipeStartState();
            dragStartPos = pendingStartPos;
            swipeCancelBaseline = pendingStartPos;
            lastMovePos = pendingStartPos;
            isFirstPointerMove = false;
          } else {
            clearPendingSwipeStartState();
            swipeFromScrollable = false;
          }
        }
      }
    }

    const previousPos = lastMovePos;
    const movement =
      previousPos === null
        ? { x: 0, y: 0 }
        : { x: currentPos.x - previousPos.x, y: currentPos.y - previousPos.y };
    lastMovePos = currentPos;
    handleMoveCore(swipeEvent, currentPos, movement);

    if (endAfterMove) handleEnd(swipeEvent);
  }

  return {
    swiping: swiping as Readonly<Ref<boolean>>,
    handleStart,
    handleMove,
    handleEnd,
    reset,
  };
}
