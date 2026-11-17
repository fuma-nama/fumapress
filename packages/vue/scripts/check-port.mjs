// Compares the class names of Fumadocs UI source files with their Vue ports.
//
//   node scripts/check-port.mjs <source.tsx> <ported folder or file>
//     lists the classes the port lost and the ones it added
//   node scripts/check-port.mjs --all <source root> <ui root>
//     every source file with a port at the mirrored path: its lost classes, without the state selectors of Base UI,
//     which a port translates for Reka UI (`data-open:` to `data-[state=open]:`)
//
// Lost classes are bugs unless they are state selectors with a translated counterpart on the added side.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function read(file) {
  if (!statSync(file).isDirectory()) return readFileSync(file, "utf8");
  return readdirSync(file)
    .filter((name) => /\.(vue|ts)$/.test(name))
    .map((name) => readFileSync(path.join(file, name), "utf8"))
    .join("\n");
}

// a class has a utility shape: a dash, a variant colon, or brackets
const looksLikeClass = (token) =>
  /^[a-z0-9!*@[\]()/:._%&>~+,#=-]+$/i.test(token) &&
  /[-:[]/.test(token) &&
  !/^(https?:|\.\/|\.\.\/|@|#)/.test(token) &&
  !/^[a-z]+:\/\//.test(token) &&
  // code in a template literal, not classes: `key:`, `[a,`, `fn(arg:`; an arbitrary variant starts with `[&`
  !/[:,]$/.test(token) &&
  !/^(\(|\[(?!&))/.test(token) &&
  !/[^-]\(/.test(token) &&
  !/^-+$/.test(token);

function classesOf(source) {
  // an apostrophe in a comment would open a string
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out = new Set();
  for (const match of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/gs)) {
    for (const token of match[2].split(/\s+/)) {
      if (token && looksLikeClass(token)) out.add(token);
    }
  }
  return out;
}

function compare(source, target) {
  const before = classesOf(read(source));
  const after = classesOf(read(target));
  return {
    before,
    after,
    lost: [...before].filter((token) => !after.has(token)).sort(),
    added: [...after].filter((token) => !before.has(token)).sort(),
  };
}

// the state and transition selectors of Base UI, and module names that only look like classes
const translated =
  /data-(\[)?(open|closed|active|inactive|panel-open|popup-open|starting-style|ending-style|checked|unchecked|pressed|disabled|highlighted|side|orientation|expanded)|^(lucide-react|react-|fumadocs-core|@base-ui|next-themes|motion\/)|--(transform-origin|available-height|anchor-width|collapsible-panel-height|accordion-panel-height)/;

function walk(root, out = []) {
  for (const name of readdirSync(root)) {
    const file = path.join(root, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (/\.tsx?$/.test(name)) out.push(file);
  }
  return out;
}

const args = process.argv.slice(2);
if (args[0] === "--all" && args[1] && args[2]) {
  const [, sourceRoot, uiRoot] = args;
  let failed = 0;
  for (const source of walk(sourceRoot).sort()) {
    const module = path.relative(sourceRoot, source).replace(/\.tsx?$/, "");
    // `toc/index.tsx` is the folder `toc`
    const target = path.join(uiRoot, module.replace(/\/index$/, ""));
    if (!existsSync(target)) continue;
    const { lost } = compare(source, target);
    const real = lost.filter((token) => !translated.test(token));
    if (real.length > 0) failed++;
    console.log(
      `${real.length === 0 ? "ok  " : "LOST"} ${module}${real.length > 0 ? `: ${real.join(" ")}` : ""}`,
    );
  }
  process.exit(failed > 0 ? 1 : 0);
}

const [source, target] = args;
if (!source || !target) {
  console.error("usage: node scripts/check-port.mjs <source.tsx> <ported folder or file>");
  console.error("       node scripts/check-port.mjs --all <source root> <ui root>");
  process.exit(2);
}

const { before, after, lost, added } = compare(source, target);
console.log(
  `${path.basename(source)}: ${before.size} classes in the source, ${after.size} in the port`,
);
console.log(`lost (${lost.length}):${lost.map((token) => `\n  ${token}`).join("")}`);
console.log(`added (${added.length}):${added.map((token) => `\n  ${token}`).join("")}`);
process.exit(lost.length > 0 ? 1 : 0);
