/** a small highlighter for the snippets of the playground, which it writes itself: TSX, TS and CSS imports */

export type TokenKind =
  | "plain"
  | "comment"
  | "keyword"
  | "string"
  | "function"
  | "constant"
  | "tag"
  | "punctuation";

export interface Token {
  text: string;
  kind: TokenKind;
}

const keywords = new Set([
  "import",
  "from",
  "export",
  "default",
  "return",
  "const",
  "let",
  "new",
  "if",
  "function",
  "async",
  "await",
]);
const constants = new Set(["true", "false", "null", "undefined"]);

const pattern =
  /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`)|(<\/?)([A-Za-z][\w.]*)|(@[a-z-]+)|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)(\s*\()?|(\.\.\.|[{}()[\];,.<>/=!:?*&|+-]+)|(\s+|.)/g;

function push(line: Token[], text: string, kind: TokenKind) {
  const last = line.at(-1);
  if (last && last.kind === kind) last.text += text;
  else line.push({ text, kind });
}

/** tokens of each line */
export function tokenize(code: string): Token[][] {
  const lines: Token[][] = [];
  for (const source of code.split("\n")) {
    const line: Token[] = [];
    for (const m of source.matchAll(pattern)) {
      const [, comment, string, tagOpen, tagName, at, number, word, call, punctuation, other] = m;
      if (comment) push(line, comment, "comment");
      else if (string) push(line, string, "string");
      else if (tagOpen && tagName) {
        push(line, tagOpen, "punctuation");
        push(line, tagName, "tag");
      } else if (at) push(line, at, "keyword");
      else if (number) push(line, number, "constant");
      else if (word) {
        if (keywords.has(word)) push(line, word, "keyword");
        else if (constants.has(word)) push(line, word, "constant");
        else if (call) push(line, word, "function");
        else push(line, word, "plain");
        // the space and parenthesis after a word, e.g. `if (` and `renderPage(`
        if (call) push(line, call, "punctuation");
      } else if (punctuation) push(line, punctuation, "punctuation");
      else if (other) push(line, other, "plain");
    }
    lines.push(line);
  }
  return lines;
}
