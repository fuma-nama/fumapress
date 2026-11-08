import { createHighlights } from "fumadocs-core/highlight/highlights";
import vitesseLight from "@pierre/highlights/themes/vitesse-light";
import catppuccinMocha from "@pierre/highlights/themes/catppuccin-mocha";

/** the code of MDX pages and type tables */
export const highlighter = createHighlights({
  themes: { light: vitesseLight, dark: catppuccinMocha },
});
