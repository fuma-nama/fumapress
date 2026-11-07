import defaultColors from "fumadocs-ui/css/lib/default-colors.css?raw";
import neutral from "fumadocs-ui/css/neutral.css?raw";
import ocean from "fumadocs-ui/css/ocean.css?raw";
import purple from "fumadocs-ui/css/purple.css?raw";
import emerald from "fumadocs-ui/css/emerald.css?raw";
import ruby from "fumadocs-ui/css/ruby.css?raw";
import type { ThemeId } from "./options";

const sources: Record<ThemeId, string> = { neutral, ocean, purple, emerald, ruby };

/**
 * The colors of a Fumadocs UI theme as plain CSS, to swap at runtime. The theme files are Tailwind sources: `@theme` holds
 * the light colors. The selectors win over the theme of `src/app.css` (its own `.dark` colors included), and the reset
 * undoes the sidebar colors that `neutral.css` gives every theme there.
 */
export function themeCss(id: ThemeId): string {
  const reset =
    "html:root.dark #nd-sidebar { --color-fd-muted: inherit; --color-fd-secondary: inherit; --color-fd-muted-foreground: inherit; }";
  return [defaultColors, sources[id]]
    .map((css) =>
      css
        .replace(/@import[^;]*;/g, "")
        // static colors, like the ones of callouts, are the same in every theme
        .replace(/@theme\s+static\s*\{[^}]*\}/g, "")
        .replace(/@theme\s*\{/g, "html:root {")
        .replace(/(^|\n|\})\s*\.dark(?=[\s{])/g, "$1\nhtml:root.dark"),
    )
    .reduce((out, css) => `${out}\n${css}`, reset);
}
