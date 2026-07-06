import { Fragment, type ReactNode } from "react";
import type {
  MintlifyBanner,
  MintlifyDocsJson,
  MintlifyFontDetail,
  MintlifyFonts,
} from "../schema";
import { renderIntegrations } from "./integrations";

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
  const families = fonts
    .filter((font) => !font.source)
    .map(
      (font) =>
        `family=${encodeURIComponent(font.family).replace(/%20/g, "+")}${
          font.weight ? `:wght@${font.weight}` : ":wght@400;500;600;700"
        }`,
    );

  if (families.length === 0) return;
  return `https://fonts.googleapis.com/css2?${[...new Set(families)].join("&")}&display=swap`;
}

export function buildRootHead(docs: MintlifyDocsJson): ReactNode {
  const nodes: ReactNode[] = [];

  nodes.push(<style dangerouslySetInnerHTML={{ __html: buildThemeCss(docs) }} />);

  // ---- favicon ----
  const favicon = docs.favicon;
  if (typeof favicon === "string") {
    nodes.push(<link rel="icon" href={favicon} />);
  } else if (favicon) {
    nodes.push(
      <link rel="icon" href={favicon.light} media="(prefers-color-scheme: light)" />,
      <link rel="icon" href={favicon.dark} media="(prefers-color-scheme: dark)" />,
    );
  }

  // ---- fonts ----
  const fonts = docs.fonts;
  if (fonts) {
    const { heading, body } = normalizeFonts(fonts);
    const href = googleFontsHref(
      [...new Set([heading, body])].filter((font) => font !== undefined),
    );

    if (href) {
      nodes.push(
        <link rel="preconnect" href="https://fonts.googleapis.com" />,
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />,
        <link rel="stylesheet" href={href} />,
      );
    }
  }

  // ---- description ----
  if (docs.description) {
    nodes.push(<meta name="description" content={docs.description} />);
  }

  // ---- seo.metatags ----
  if (docs.seo?.metatags) {
    for (const [key, value] of Object.entries(docs.seo.metatags)) {
      if (/^(og|article|fb|profile|book|music|video):/.test(key)) {
        nodes.push(<meta property={key} content={value} />);
      } else {
        nodes.push(<meta name={key} content={value} />);
      }
    }
  }

  // ---- integrations ----
  if (docs.integrations) {
    nodes.push(renderIntegrations(docs.integrations));
  }

  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}
