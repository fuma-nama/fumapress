import { dynamicIconImports } from "lucide-react/dynamic";
import type { ComponentType, ReactNode } from "react";
import type { MintlifyIcon } from "./schema";

/**
 * Icon rendering for Mintlify `icon` properties.
 *
 * Mintlify supports Font Awesome (default), Lucide and Tabler icon names.
 * Fumapress renders icons with Lucide: Lucide names map 1:1, while Font
 * Awesome / Tabler names are matched best-effort (exact name, then a
 * translation table for common names). Unknown names are skipped with a
 * warning.
 */

interface IconProps {
  className?: string;
  [key: string]: unknown;
}

/** common Font Awesome / Tabler names -> Lucide equivalents */
const ICON_ALIASES: Record<string, string> = {
  house: "house",
  home: "house",
  gear: "settings",
  gears: "settings",
  cog: "settings",
  envelope: "mail",
  bolt: "zap",
  "bolt-lightning": "zap",
  "circle-info": "info",
  "info-circle": "info",
  "circle-question": "circle-help",
  "question-circle": "circle-help",
  "circle-exclamation": "circle-alert",
  "exclamation-circle": "circle-alert",
  "triangle-exclamation": "triangle-alert",
  "exclamation-triangle": "triangle-alert",
  warning: "triangle-alert",
  "pen-to-square": "pencil",
  edit: "pencil",
  "file-lines": "file-text",
  "file-alt": "file-text",
  "shield-halved": "shield",
  "shield-half": "shield",
  "circle-play": "circle-play",
  "play-circle": "circle-play",
  "chart-simple": "chart-bar",
  "chart-column": "chart-bar",
  "chart-area": "chart-line",
  "wand-magic-sparkles": "wand-sparkles",
  "wand-magic": "wand-sparkles",
  magic: "wand-sparkles",
  "screwdriver-wrench": "wrench",
  tools: "wrench",
  "grid-2": "layout-grid",
  "grid-4": "grid-3x3",
  "table-cells": "table",
  "location-dot": "map-pin",
  "map-location": "map-pin",
  "map-location-dot": "map-pin",
  "earth-americas": "earth",
  "globe-americas": "earth",
  "paper-plane": "send",
  "share-nodes": "share-2",
  "share-alt": "share-2",
  "arrow-up-right-from-square": "external-link",
  "up-right-from-square": "external-link",
  "trash-can": "trash-2",
  "trash-alt": "trash-2",
  "floppy-disk": "save",
  save: "save",
  flask: "flask-conical",
  vial: "flask-conical",
  microchip: "cpu",
  "brain-circuit": "brain-circuit",
  robot: "bot",
  "user-group": "users",
  "user-friends": "users",
  "people-group": "users",
  "money-bill": "banknote",
  "dollar-sign": "dollar-sign",
  "circle-dollar": "circle-dollar-sign",
  "hand-holding-heart": "hand-heart",
  "rectangle-terminal": "square-terminal",
  "terminal-window": "square-terminal",
  "code-branch": "git-branch",
  "code-merge": "git-merge",
  "code-commit": "git-commit-horizontal",
  "code-pull-request": "git-pull-request",
  "list-ul": "list",
  "list-check": "list-checks",
  "square-check": "square-check",
  "check-square": "square-check",
  comment: "message-square",
  comments: "messages-square",
  "comment-dots": "message-square-more",
  message: "message-square",
  "book-open-cover": "book-open",
  "book-blank": "book",
  books: "library",
  "graduation-cap": "graduation-cap",
  "building-columns": "landmark",
  "cart-shopping": "shopping-cart",
  "shopping-cart": "shopping-cart",
  "bag-shopping": "shopping-bag",
  mobile: "smartphone",
  "mobile-screen": "smartphone",
  desktop: "monitor",
  display: "monitor",
  "hard-drive": "hard-drive",
  sitemap: "network",
  "diagram-project": "network",
  "plug-circle-bolt": "plug-zap",
  "right-to-bracket": "log-in",
  "arrow-right-to-bracket": "log-in",
  "right-from-bracket": "log-out",
  "arrow-right-from-bracket": "log-out",
  sliders: "sliders-horizontal",
  "sliders-up": "sliders-vertical",
  "circle-nodes": "waypoints",
  spinner: "loader",
  rotate: "rotate-cw",
  "arrows-rotate": "refresh-cw",
  "clock-rotate-left": "history",
  stopwatch: "timer",
  "hourglass-half": "hourglass",
  "cloud-arrow-up": "cloud-upload",
  "cloud-arrow-down": "cloud-download",
  "file-arrow-up": "file-up",
  "file-arrow-down": "file-down",
  "circle-user": "circle-user",
  "user-circle": "circle-user",
  "id-badge": "badge-check",
  certificate: "badge-check",
  "ranking-star": "trophy",
  medal: "medal",
  cube: "box",
  cubes: "boxes",
  "box-open": "package-open",
  "boxes-stacked": "boxes",
  "truck-fast": "truck",
  "paint-roller": "paint-roller",
  "paintbrush-pencil": "paintbrush",
  palette: "palette",
  swatchbook: "swatch-book",
  "eye-slash": "eye-off",
  "bell-slash": "bell-off",
  "volume-high": "volume-2",
  "volume-xmark": "volume-x",
  microphone: "mic",
  "microphone-slash": "mic-off",
  "video-slash": "video-off",
  "magnifying-glass": "search",
  "magnifying-glass-plus": "zoom-in",
  "magnifying-glass-minus": "zoom-out",
  xmark: "x",
  times: "x",
  "check-double": "check-check",
  "plus-large": "plus",
  "minus-large": "minus",
  language: "languages",
  "earth-europe": "earth",
  "earth-asia": "earth",
  "globe-pointer": "globe",
};

type LucideModule = { default: ComponentType<IconProps> };

const iconCache = new Map<string, Promise<ComponentType<IconProps> | undefined>>();
const warned = new Set<string>();

function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^fa-/, "")
    .replace(/[\s_]+/g, "-");
}

export function iconNameOf(icon: MintlifyIcon | undefined): string | undefined {
  if (typeof icon === "string") return icon;
  if (icon && typeof icon === "object" && "name" in icon) return icon.name;
}

export async function resolveIconComponent(
  name: string,
): Promise<ComponentType<IconProps> | undefined> {
  const normalized = normalizeIconName(name);
  const lucideName = normalized in dynamicIconImports ? normalized : ICON_ALIASES[normalized];

  if (!lucideName || !(lucideName in dynamicIconImports)) {
    if (!warned.has(normalized)) {
      warned.add(normalized);
      console.warn(
        `[Fumapress Mintlify] No Lucide equivalent found for icon "${name}", it will be skipped.`,
      );
    }
    return;
  }

  let cached = iconCache.get(lucideName);
  if (!cached) {
    cached = (
      dynamicIconImports[lucideName as keyof typeof dynamicIconImports]() as Promise<LucideModule>
    ).then((mod) => mod.default);
    iconCache.set(lucideName, cached);
  }

  return cached;
}

export async function renderMintlifyIcon(
  icon: MintlifyIcon | undefined,
  props?: IconProps,
): Promise<ReactNode> {
  const name = iconNameOf(icon);
  if (!name) return;

  const Icon = await resolveIconComponent(name);
  if (!Icon) return;

  return <Icon {...props} />;
}
