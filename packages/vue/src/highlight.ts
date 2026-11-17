import type { Theme } from "@pierre/highlights";
import { createHighlights as create } from "fumadocs-core/highlight/highlights";
import type { Root } from "hast";

/** a syntax highlighter, the `Highlighter` of Fumadocs */
export interface Highlighter {
  /** load languages before highlighting, for highlighters loading them on demand */
  loadLanguage?: (...langs: string[]) => Promise<void>;
  /** highlight code into `pre > code > span.line`, with `meta` added to `<pre>` */
  codeToHast: (code: string, options: HighlightCodeOptions) => Root;
}

export interface HighlightCodeOptions {
  lang: string;
  /** `inline` renders the content of `<code>` only @defaultValue "classic" */
  structure?: "classic" | "inline";
  /** attributes of the code block, like its title */
  meta?: Record<string, unknown>;
}

export interface HighlightsOptions {
  /** themes from `@pierre/highlights/themes` @defaultValue GitHub Light and GitHub Dark */
  themes?: Record<string, Theme>;
}

/**
 * The highlighter of the Markdown pipeline (`@pierre/highlights`), for code highlighted at runtime. Its languages are
 * built in, and it works on the server and in the browser.
 */
export function createHighlights(options?: HighlightsOptions): Highlighter {
  return create(options);
}
