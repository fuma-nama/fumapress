import { createHighlighterCoreSync, type ThemeRegistration } from "shiki/core";
import tsx from "shiki/dist/langs/tsx.mjs";
import bash from "shiki/dist/langs/bash.mjs";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/** ink colors from `washi.css`, so code follows the theme of the page */
const washi: ThemeRegistration = {
  name: "washi",
  type: "light",
  fg: "var(--w-code-fg)",
  bg: "transparent",
  settings: [
    { settings: { foreground: "var(--w-code-fg)", background: "transparent" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "var(--w-code-comment)", fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "variable.language",
      ],
      settings: { foreground: "var(--w-code-keyword)" },
    },
    {
      scope: ["string", "string.quoted", "punctuation.definition.string", "string.template"],
      settings: { foreground: "var(--w-code-string)" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call entity.name.function",
      ],
      settings: { foreground: "var(--w-code-function)", fontStyle: "bold" },
    },
    {
      scope: [
        "constant",
        "constant.numeric",
        "constant.language",
        "entity.name.tag",
        "support.class.component",
        "entity.name.type",
      ],
      settings: { foreground: "var(--w-code-constant)" },
    },
    {
      scope: ["punctuation", "meta.brace", "keyword.operator", "meta.object-literal.key"],
      settings: { foreground: "var(--w-code-punctuation)" },
    },
    {
      scope: ["meta.object-literal.key", "variable.other.property", "support.type.property-name"],
      settings: { foreground: "var(--w-code-fg)" },
    },
  ],
};

const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  themes: [washi],
  langs: [tsx, bash],
});

/**
 * @param focus - when given, lines it rejects are dimmed (`.w-dim`), so the lines that matter stand out
 */
export function highlight(
  code: string,
  lang: "tsx" | "bash" = "tsx",
  focus?: (line: string) => boolean,
) {
  const lines = code.split("\n");
  return highlighter.codeToHtml(code, {
    lang,
    theme: "washi",
    transformers: focus
      ? [
          {
            line(node, line) {
              if (!focus(lines[line - 1] ?? "")) this.addClassToHast(node, "w-dim");
            },
          },
        ]
      : [],
  });
}
