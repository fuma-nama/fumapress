import type { HeadTag } from "./types";

/**
 * Tags with a key are unique: `title`, a `meta` by its `name`, `property` or `http-equiv`, the canonical link, and an
 * alternate link by its `hreflang`.
 */
export function keyOf(tag: HeadTag): string | undefined {
  const attrs = tag.attrs ?? {};
  if (tag.tag === "title") return "title";
  if (tag.tag === "meta") {
    for (const name of ["name", "property", "http-equiv"] as const) {
      if (typeof attrs[name] === "string") return `meta:${name}:${attrs[name]}`;
    }
    if (attrs.charset !== undefined) return "meta:charset";
  }
  if (tag.tag === "link") {
    if (attrs.rel === "canonical") return "link:canonical";
    if (attrs.rel === "alternate" && typeof attrs.hreflang === "string") {
      return `link:alternate:${attrs.hreflang}`;
    }
  }
}

/** later lists win over earlier ones by key, other tags are kept except exact duplicates */
export function mergeHead(...lists: (readonly HeadTag[] | undefined)[]): HeadTag[] {
  const keyed = new Map<string, HeadTag>();
  const seen = new Set<string>();
  const out: (HeadTag | string)[] = [];

  for (const list of lists) {
    for (const tag of list ?? []) {
      const key = keyOf(tag);
      if (key !== undefined) {
        if (!keyed.has(key)) out.push(key);
        keyed.set(key, tag);
        continue;
      }
      const id = JSON.stringify([tag.tag, tag.attrs ?? {}, tag.content ?? ""]);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(tag);
    }
  }
  return out.map((item) => (typeof item === "string" ? keyed.get(item)! : item));
}

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => escapes[char]!);
}

const voidTags = new Set(["meta", "link", "base"]);
/** the content of these is code, where entities are not decoded: only the closing tag is escaped */
const rawTags = new Set(["script", "style"]);

export function renderHead(tags: readonly HeadTag[]): string {
  let out = "";
  for (const { tag, attrs = {}, content = "" } of tags) {
    if (!/^[a-z][a-z0-9-]*$/i.test(tag)) continue;
    out += `<${tag}`;
    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined || value === false || !/^[^\s"'<>/=]+$/.test(name)) continue;
      out += value === true || value === "" ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`;
    }
    out += ">";
    if (voidTags.has(tag)) continue;
    out += rawTags.has(tag)
      ? content.replace(/<\/(script|style)/gi, "<\\/$1")
      : escapeHtml(content);
    out += `</${tag}>`;
  }
  return out;
}

/**
 * The tags a site writes itself, in its config and its theme: an `href` or `src` that is a path of the site, like
 * `/favicon.svg`, gets the base path, as a link in the content does.
 */
export function withBase(tags: readonly HeadTag[] | undefined, base: string): HeadTag[] {
  return (tags ?? []).map((tag) => {
    const attrs = { ...tag.attrs };
    for (const name of ["href", "src"]) {
      const value = attrs[name];
      if (typeof value === "string" && /^\/(?!\/)/.test(value)) attrs[name] = base + value.slice(1);
    }
    return { ...tag, attrs };
  });
}
