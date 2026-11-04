import type { HeadTag } from "fumadocs-core/framework/plugin";
import type {
  MintlifyBanner,
  MintlifyDocsJson,
  MintlifyFontDetail,
  MintlifyFonts,
} from "../schema";
import { integrationTags } from "./integrations";

function normalizeFonts(fonts: MintlifyFonts): {
  heading?: MintlifyFontDetail;
  body?: MintlifyFontDetail;
} {
  if ("family" in fonts && typeof fonts.family === "string") {
    const detail = fonts as MintlifyFontDetail;
    return { heading: detail, body: detail };
  }

  const split = fonts as { heading?: MintlifyFontDetail; body?: MintlifyFontDetail };
  return { heading: split.heading, body: split.body };
}

/**
 * `<head>` content derived from docs.json: theme CSS (colors, background,
 * fonts, banner colors), favicon, seo meta tags and integration scripts.
 */

/** pick a readable foreground (text) color for the given background hex color */
export function foregroundFor(hex: string): string {
  const value = hex.replace("#", "");
  const size = value.length === 3 ? 1 : 2;
  const parse = (i: number) => {
    const channel = value.slice(i * size, (i + 1) * size);
    return parseInt(size === 1 ? channel + channel : channel, 16) / 255;
  };

  if (value.length !== 3 && value.length !== 6) return "#ffffff";

  const [r, g, b] = [parse(0), parse(1), parse(2)];
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.55 ? "#0a0a0a" : "#ffffff";
}

function bannerColors(banner: MintlifyBanner, primary: string) {
  const type = banner.type ?? "info";
  const light =
    banner.color?.light ??
    banner.color?.dark ??
    (type === "warning" ? "#d97706" : type === "critical" ? "#dc2626" : primary);
  const dark = banner.color?.dark ?? light;

  return { light, dark };
}

export function buildThemeCss(docs: MintlifyDocsJson): string {
  const rules: string[] = [];
  const root: string[] = [];
  const dark: string[] = [];

  // ---- colors ----
  const { primary, light } = docs.colors;
  root.push(
    `--color-fd-primary: ${primary};`,
    `--color-fd-primary-foreground: ${foregroundFor(primary)};`,
    `--color-fd-ring: ${primary};`,
  );
  const darkPrimary = light ?? primary;
  dark.push(
    `--color-fd-primary: ${darkPrimary};`,
    `--color-fd-primary-foreground: ${foregroundFor(darkPrimary)};`,
    `--color-fd-ring: ${darkPrimary};`,
  );

  // ---- background color ----
  const background = docs.background;
  if (background?.color?.light) root.push(`--color-fd-background: ${background.color.light};`);
  if (background?.color?.dark) dark.push(`--color-fd-background: ${background.color.dark};`);

  rules.push(`:root{${root.join("")}}`, `.dark{${dark.join("")}}`);

  // ---- background image ----
  if (background?.image) {
    const image = background.image;
    const bodyCss = (url: string) =>
      `background-image:url(${JSON.stringify(url)});background-size:cover;background-position:center;background-attachment:fixed;`;

    if (typeof image === "string") {
      rules.push(`body{${bodyCss(image)}}`);
    } else {
      rules.push(`body{${bodyCss(image.light)}}`, `.dark body{${bodyCss(image.dark)}}`);
    }
  }

  // ---- light/dark visibility helpers (used by logo, etc.) ----
  rules.push(
    ".mintlify-light{display:block}.dark .mintlify-light{display:none}",
    ".mintlify-dark{display:none}.dark .mintlify-dark{display:block}",
  );

  // ---- fonts ----
  const fonts = docs.fonts;
  if (fonts) {
    const { heading, body } = normalizeFonts(fonts);

    for (const font of new Set([heading, body])) {
      if (font?.source) {
        rules.push(
          `@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(font.source)})${font.format ? ` format(${JSON.stringify(font.format)})` : ""};font-weight:${font.weight ?? "100 900"};font-display:swap;}`,
        );
      }
    }

    if (body) {
      rules.push(
        `body{font-family:${JSON.stringify(body.family)},ui-sans-serif,system-ui,sans-serif;${body.weight ? `font-weight:${body.weight};` : ""}}`,
      );
    }
    if (heading) {
      rules.push(
        `h1,h2,h3,h4,h5,h6{font-family:${JSON.stringify(heading.family)},ui-sans-serif,system-ui,sans-serif;${heading.weight ? `font-weight:${heading.weight};` : ""}}`,
      );
    }
  }

  // ---- banner colors ----
  if (docs.banner) {
    const { light: bannerLight, dark: bannerDark } = bannerColors(docs.banner, primary);
    rules.push(
      `.mintlify-banner{background-color:${bannerLight} !important;color:${foregroundFor(bannerLight)} !important;}`,
      `.dark .mintlify-banner{background-color:${bannerDark} !important;color:${foregroundFor(bannerDark)} !important;}`,
      ".mintlify-banner a{text-decoration:underline;font-weight:600;}",
    );
  }

  return rules.join("\n");
}

function googleFontsHref(fonts: MintlifyFontDetail[]): string | undefined {
  const families = new Set<string>();
  for (const font of fonts) {
    if (font.source) continue;
    families.add(
      `family=${encodeURIComponent(font.family).replace(/%20/g, "+")}${
        font.weight ? `:wght@${font.weight}` : ":wght@400;500;600;700"
      }`,
    );
  }

  if (families.size === 0) return;
  return `https://fonts.googleapis.com/css2?${[...families].join("&")}&display=swap`;
}

/** head tags of every page: theme CSS, favicon, fonts, description, `seo.metatags` and integrations */
export function buildRootHead(docs: MintlifyDocsJson): HeadTag[] {
  const tags: HeadTag[] = [{ tag: "style", children: buildThemeCss(docs) }];

  const favicon = docs.favicon;
  if (typeof favicon === "string") {
    tags.push({ tag: "link", attrs: { rel: "icon", href: favicon } });
  } else if (favicon) {
    tags.push(
      {
        tag: "link",
        attrs: { rel: "icon", href: favicon.light, media: "(prefers-color-scheme: light)" },
      },
      {
        tag: "link",
        attrs: { rel: "icon", href: favicon.dark, media: "(prefers-color-scheme: dark)" },
      },
    );
  }

  const fonts = docs.fonts;
  if (fonts) {
    const { heading, body } = normalizeFonts(fonts);
    const href = googleFontsHref(
      [...new Set([heading, body])].filter((font) => font !== undefined),
    );

    if (href) {
      tags.push(
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
        },
        { tag: "link", attrs: { rel: "stylesheet", href } },
      );
    }
  }

  if (docs.description) {
    tags.push({ tag: "meta", attrs: { name: "description", content: docs.description } });
  }

  for (const [key, content] of Object.entries(docs.seo?.metatags ?? {})) {
    const name = /^(og|article|fb|profile|book|music|video):/.test(key) ? "property" : "name";
    tags.push({ tag: "meta", attrs: { [name]: key, content } });
  }

  if (docs.integrations) tags.push(...integrationTags(docs.integrations));
  return tags;
}
