// A port of `useScrollLock` of Base UI (`@base-ui/utils/useScrollLock`): locks the scroll of the page, keeping the
// scrollbar gutter so the page doesn't shift.

let originalHtmlStyles: Partial<CSSStyleDeclaration> = {};
let originalBodyStyles: Partial<CSSStyleDeclaration> = {};
let originalHtmlScrollBehavior = "";

function isIOS() {
  return (
    /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isWebKit() {
  return typeof CSS !== "undefined" && CSS.supports?.("-webkit-backdrop-filter", "none");
}

function isOverflowElement(element: Element) {
  const { overflow, overflowX, overflowY, display } = getComputedStyle(element);
  return (
    /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) &&
    display !== "inline" &&
    display !== "contents"
  );
}

// The viewport's overflow comes from <html> when it establishes its own scroll container, and from <body> otherwise.
function getViewportScroller(html: HTMLElement, body: HTMLElement) {
  return isOverflowElement(html) ? html : body;
}

function isPageScrollLocked(html: HTMLElement, body: HTMLElement) {
  return /hidden|clip/.test(getComputedStyle(getViewportScroller(html, body)).overflowY);
}

function hasInsetScrollbars() {
  return window.innerWidth - document.documentElement.clientWidth > 0;
}

function supportsStableScrollbarGutter() {
  if (typeof CSS === "undefined" || !CSS.supports?.("scrollbar-gutter", "stable")) return false;
  const html = document.documentElement;
  const scrollContainer = getViewportScroller(html, document.body);
  const originalOverflowY = scrollContainer.style.overflowY;
  const originalGutter = html.style.scrollbarGutter;
  html.style.scrollbarGutter = "stable";
  scrollContainer.style.overflowY = "scroll";
  const before = scrollContainer.offsetWidth;
  scrollContainer.style.overflowY = "hidden";
  const after = scrollContainer.offsetWidth;
  scrollContainer.style.overflowY = originalOverflowY;
  html.style.scrollbarGutter = originalGutter;
  return before === after;
}

function preventScrollOverlayScrollbars() {
  const elementToLock = getViewportScroller(document.documentElement, document.body);
  const original = {
    overflowY: elementToLock.style.overflowY,
    overflowX: elementToLock.style.overflowX,
  };
  Object.assign(elementToLock.style, { overflowY: "hidden", overflowX: "hidden" });
  return () => {
    Object.assign(elementToLock.style, original);
  };
}

function preventScrollInsetScrollbars() {
  const html = document.documentElement;
  const body = document.body;
  let scrollTop = 0;
  let scrollLeft = 0;
  let updateGutterOnly = false;
  let resizeFrame = 0;

  // Pinch-zoom in Safari causes a shift. Just don't lock scroll if there's any pinch-zoom.
  if (isWebKit() && (window.visualViewport?.scale ?? 1) !== 1) return () => {};

  function lockScroll() {
    const htmlStyles = getComputedStyle(html);
    const bodyStyles = getComputedStyle(body);
    const hasBothEdges = (htmlStyles.scrollbarGutter || "").includes("both-edges");
    const scrollbarGutterValue = hasBothEdges ? "stable both-edges" : "stable";
    scrollTop = html.scrollTop;
    scrollLeft = html.scrollLeft;
    originalHtmlStyles = {
      scrollbarGutter: html.style.scrollbarGutter,
      overflowY: html.style.overflowY,
      overflowX: html.style.overflowX,
    };
    originalHtmlScrollBehavior = html.style.scrollBehavior;
    originalBodyStyles = {
      position: body.style.position,
      height: body.style.height,
      width: body.style.width,
      boxSizing: body.style.boxSizing,
      overflowY: body.style.overflowY,
      overflowX: body.style.overflowX,
      scrollBehavior: body.style.scrollBehavior,
    };
    const isScrollableY = html.scrollHeight > html.clientHeight;
    const isScrollableX = html.scrollWidth > html.clientWidth;
    const hasConstantOverflowY =
      htmlStyles.overflowY === "scroll" || bodyStyles.overflowY === "scroll";
    const hasConstantOverflowX =
      htmlStyles.overflowX === "scroll" || bodyStyles.overflowX === "scroll";
    // Values can be negative in Firefox
    const scrollbarWidth = Math.max(0, window.innerWidth - body.clientWidth);
    const scrollbarHeight = Math.max(0, window.innerHeight - body.clientHeight);
    // Avoid shift due to the default <body> margin.
    const marginY = parseFloat(bodyStyles.marginTop) + parseFloat(bodyStyles.marginBottom);
    const marginX = parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight);
    const elementToLock = getViewportScroller(html, body);
    updateGutterOnly = supportsStableScrollbarGutter();

    // DOM writes: do not read the DOM past this point
    if (updateGutterOnly) {
      html.style.scrollbarGutter = scrollbarGutterValue;
      elementToLock.style.overflowY = "hidden";
      elementToLock.style.overflowX = "hidden";
      return;
    }
    Object.assign(html.style, {
      scrollbarGutter: scrollbarGutterValue,
      overflowY: "hidden",
      overflowX: "hidden",
    });
    if (isScrollableY || hasConstantOverflowY) html.style.overflowY = "scroll";
    if (isScrollableX || hasConstantOverflowX) html.style.overflowX = "scroll";
    Object.assign(body.style, {
      position: "relative",
      height:
        marginY || scrollbarHeight ? `calc(100dvh - ${marginY + scrollbarHeight}px)` : "100dvh",
      width: marginX || scrollbarWidth ? `calc(100vw - ${marginX + scrollbarWidth}px)` : "100vw",
      boxSizing: "border-box",
      overflowY: "hidden",
      overflowX: "hidden",
      scrollBehavior: "unset",
    });
    body.scrollTop = scrollTop;
    body.scrollLeft = scrollLeft;
    html.setAttribute("data-base-ui-scroll-locked", "");
    html.style.scrollBehavior = "unset";
  }

  function cleanup() {
    Object.assign(html.style, originalHtmlStyles);
    Object.assign(body.style, originalBodyStyles);
    if (!updateGutterOnly) {
      html.scrollTop = scrollTop;
      html.scrollLeft = scrollLeft;
      html.removeAttribute("data-base-ui-scroll-locked");
      html.style.scrollBehavior = originalHtmlScrollBehavior;
    }
  }

  function handleResize() {
    cleanup();
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(lockScroll);
  }

  lockScroll();
  window.addEventListener("resize", handleResize);
  return () => {
    cancelAnimationFrame(resizeFrame);
    cleanup();
    window.removeEventListener("resize", handleResize);
  };
}

class ScrollLocker {
  lockCount = 0;
  restore: (() => void) | null = null;
  timeoutLock: ReturnType<typeof setTimeout> | undefined;
  timeoutUnlock: ReturnType<typeof setTimeout> | undefined;

  acquire() {
    this.lockCount += 1;
    if (this.lockCount === 1 && this.restore === null) {
      clearTimeout(this.timeoutLock);
      this.timeoutLock = setTimeout(() => this.lock(), 0);
    }
    return this.release;
  }

  release = () => {
    this.lockCount -= 1;
    if (this.lockCount === 0 && this.restore) {
      clearTimeout(this.timeoutUnlock);
      this.timeoutUnlock = setTimeout(this.unlock, 0);
    }
  };

  unlock = () => {
    if (this.lockCount === 0 && this.restore) {
      this.restore();
      this.restore = null;
    }
  };

  lock() {
    if (this.lockCount === 0 || this.restore !== null) return;
    const html = document.documentElement;
    const body = document.body;

    // The page is already locked by something else: wait for that lock to clear before taking over.
    if (isPageScrollLocked(html, body)) {
      const observer = new MutationObserver(() => {
        if (isPageScrollLocked(html, body)) return;
        observer.disconnect();
        this.restore = null;
        this.lock();
      });
      observer.observe(html, { attributes: true });
      observer.observe(body, { attributes: true });
      this.restore = () => observer.disconnect();
      return;
    }

    this.restore =
      isIOS() || !hasInsetScrollbars()
        ? preventScrollOverlayScrollbars()
        : preventScrollInsetScrollbars();
  }
}

const SCROLL_LOCKER = new ScrollLocker();

/** Locks the scroll of the document, returns the function to release it. */
export function acquireScrollLock(): () => void {
  return SCROLL_LOCKER.acquire();
}
