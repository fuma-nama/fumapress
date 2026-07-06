import { z, type output, type ZodMiniType } from "zod/mini";

/**
 * Mintlify docs.json schema.
 *
 * Based on the official schema: https://leaves.mintlify.com/schema/docs.json
 * (see also https://www.mintlify.com/docs/organize/settings)
 *
 * The full surface is parsed. Features that Fumapress cannot map 1:1 are still
 * accepted so migration never fails on valid `docs.json` files — see the
 * Mintlify integration docs for the support matrix.
 */

const hexColor = z.string();

/** `{ light, dark }` hex color pair */
export const colorPairSchema = z.looseObject({
  light: z.optional(hexColor),
  dark: z.optional(hexColor),
});

export type MintlifyColorPair = output<typeof colorPairSchema>;

/** an asset that can differ between light & dark mode */
export const themedAssetSchema = z.union([
  z.string(),
  z.looseObject({
    light: z.string(),
    dark: z.string(),
  }),
]);

export type MintlifyThemedAsset = output<typeof themedAssetSchema>;

export const iconSchema = z.union([
  z.string(),
  z.looseObject({
    style: z.optional(z.string()),
    name: z.string(),
    library: z.optional(z.enum(["fontawesome", "lucide", "tabler"])),
  }),
]);

export type MintlifyIcon = output<typeof iconSchema>;

export interface MintlifyGroup {
  group: string;
  pages?: MintlifyNavEntry[];
  icon?: MintlifyIcon;
  root?: string;
  tag?: string;
  expanded?: boolean;
  hidden?: boolean;
}

const mintlifyGroupSchema: ZodMiniType<MintlifyGroup> = z.lazy(() =>
  z.looseObject({
    group: z.string(),
    pages: z.optional(z.array(mintlifyNavEntrySchema)),
    icon: z.optional(iconSchema),
    root: z.optional(z.string()),
    tag: z.optional(z.string()),
    expanded: z.optional(z.boolean()),
    hidden: z.optional(z.boolean()),
  }),
);

const mintlifyNavEntrySchema = z.union([z.string(), mintlifyGroupSchema]);

export type MintlifyNavEntry = z.output<typeof mintlifyNavEntrySchema>;

export const mintlifyMenuItemSchema = z.looseObject({
  item: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  description: z.optional(z.string()),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
});

export const mintlifyTabSchema = z.looseObject({
  tab: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  menu: z.optional(z.array(mintlifyMenuItemSchema)),
  icon: z.optional(iconSchema),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
  align: z.optional(z.enum(["start", "end"])),
});

export const mintlifyAnchorSchema = z.looseObject({
  anchor: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  color: z.optional(colorPairSchema),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
});

export const mintlifyDropdownSchema = z.looseObject({
  dropdown: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  color: z.optional(colorPairSchema),
  description: z.optional(z.string()),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
});

export const mintlifyProductSchema = z.looseObject({
  product: z.string(),
  name: z.optional(z.string()),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  color: z.optional(colorPairSchema),
  description: z.optional(z.string()),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
});

export type MintlifyMenuItem = output<typeof mintlifyMenuItemSchema>;
export type MintlifyTab = output<typeof mintlifyTabSchema>;
export type MintlifyAnchor = output<typeof mintlifyAnchorSchema>;
export type MintlifyDropdown = output<typeof mintlifyDropdownSchema>;
export type MintlifyProduct = output<typeof mintlifyProductSchema>;
export type MintlifyLanguageNav = output<typeof mintlifyLanguageNavSchema>;

export interface MintlifyVersionNav {
  version: string;
  default?: boolean;
  tag?: string;
  hidden?: boolean;
  href?: string;
  pages?: MintlifyNavEntry[];
  groups?: MintlifyGroup[];
  tabs?: MintlifyTab[];
  anchors?: MintlifyAnchor[];
  dropdowns?: MintlifyDropdown[];
  products?: MintlifyProduct[];
  languages?: MintlifyLanguageNav[];
}

const mintlifyVersionNavSchema: ZodMiniType<MintlifyVersionNav> = z.lazy(() =>
  z.looseObject({
    version: z.string(),
    default: z.optional(z.boolean()),
    tag: z.optional(z.string()),
    hidden: z.optional(z.boolean()),
    href: z.optional(z.string()),
    pages: z.optional(z.array(mintlifyNavEntrySchema)),
    groups: z.optional(z.array(mintlifyGroupSchema)),
    tabs: z.optional(z.array(mintlifyTabSchema)),
    anchors: z.optional(z.array(mintlifyAnchorSchema)),
    dropdowns: z.optional(z.array(mintlifyDropdownSchema)),
    products: z.optional(z.array(mintlifyProductSchema)),
    languages: z.optional(z.array(mintlifyLanguageNavSchema)),
  }),
);

export const mintlifyBannerSchema = z.looseObject({
  content: z.string(),
  dismissible: z.optional(z.boolean()),
  type: z.optional(z.enum(["info", "warning", "critical"])),
  color: z.optional(colorPairSchema),
});

export type MintlifyBanner = output<typeof mintlifyBannerSchema>;

export const mintlifyFooterSchema = z.looseObject({
  socials: z.optional(z.record(z.string(), z.string())),
  links: z.optional(
    z.array(
      z.looseObject({
        header: z.optional(z.string()),
        items: z.array(
          z.looseObject({
            label: z.string(),
            href: z.string(),
          }),
        ),
      }),
    ),
  ),
});

export type MintlifyFooter = output<typeof mintlifyFooterSchema>;

const mintlifyLanguageNavSchema = z.looseObject({
  language: z.string(),
  default: z.optional(z.boolean()),
  hidden: z.optional(z.boolean()),
  href: z.optional(z.string()),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  tabs: z.optional(z.array(mintlifyTabSchema)),
  anchors: z.optional(z.array(mintlifyAnchorSchema)),
  dropdowns: z.optional(z.array(mintlifyDropdownSchema)),
  products: z.optional(z.array(mintlifyProductSchema)),
  versions: z.optional(z.array(mintlifyVersionNavSchema)),
  banner: z.optional(mintlifyBannerSchema),
  footer: z.optional(mintlifyFooterSchema),
  navbar: z.optional(z.lazy(() => mintlifyNavbarSchema)),
});

export const mintlifyNavigationSchema = z.looseObject({
  global: z.optional(
    z.looseObject({
      tabs: z.optional(z.array(mintlifyTabSchema)),
      anchors: z.optional(z.array(mintlifyAnchorSchema)),
      dropdowns: z.optional(z.array(mintlifyDropdownSchema)),
      languages: z.optional(z.array(mintlifyLanguageNavSchema)),
      versions: z.optional(z.array(mintlifyVersionNavSchema)),
      products: z.optional(z.array(mintlifyProductSchema)),
    }),
  ),
  languages: z.optional(z.array(mintlifyLanguageNavSchema)),
  versions: z.optional(z.array(mintlifyVersionNavSchema)),
  tabs: z.optional(z.array(mintlifyTabSchema)),
  anchors: z.optional(z.array(mintlifyAnchorSchema)),
  dropdowns: z.optional(z.array(mintlifyDropdownSchema)),
  products: z.optional(z.array(mintlifyProductSchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  menu: z.optional(z.array(mintlifyMenuItemSchema)),
});

export const mintlifyNavbarLinkSchema = z.looseObject({
  label: z.optional(z.string()),
  href: z.string(),
  type: z.optional(z.union([z.literal("github"), z.literal("discord"), z.string()])),
  icon: z.optional(iconSchema),
});

export const mintlifyNavbarPrimarySchema = z.looseObject({
  type: z.enum(["button", "github", "discord"]),
  label: z.optional(z.string()),
  href: z.string(),
});

export const mintlifyNavbarSchema = z.looseObject({
  links: z.optional(z.array(mintlifyNavbarLinkSchema)),
  primary: z.optional(mintlifyNavbarPrimarySchema),
});

export const mintlifyRedirectSchema = z.looseObject({
  source: z.string(),
  destination: z.string(),
  permanent: z.optional(z.boolean()),
});

export const mintlifyApiSourceSchema = z.union([
  z.string(),
  z.looseObject({
    source: z.string(),
    directory: z.optional(z.string()),
  }),
]);

const apiSources = z.union([mintlifyApiSourceSchema, z.array(mintlifyApiSourceSchema)]);

export const mintlifyApiSchema = z.looseObject({
  openapi: z.optional(apiSources),
  asyncapi: z.optional(apiSources),
  params: z.optional(
    z.looseObject({
      expanded: z.optional(z.enum(["all", "closed"])),
      post: z.optional(z.array(z.string())),
    }),
  ),
  playground: z.optional(
    z.looseObject({
      display: z.optional(z.enum(["interactive", "simple", "none", "auth"])),
      proxy: z.optional(z.boolean()),
      credentials: z.optional(z.boolean()),
    }),
  ),
  examples: z.optional(
    z.looseObject({
      defaults: z.optional(z.enum(["required", "all"])),
      languages: z.optional(z.array(z.string())),
      prefill: z.optional(z.boolean()),
      autogenerate: z.optional(z.boolean()),
    }),
  ),
  url: z.optional(z.literal("full")),
  mdx: z.optional(
    z.looseObject({
      auth: z.optional(
        z.looseObject({
          method: z.optional(z.string()),
          name: z.optional(z.string()),
        }),
      ),
      server: z.optional(z.union([z.string(), z.array(z.string())])),
    }),
  ),
});

const fontDetailSchema = z.looseObject({
  family: z.string(),
  weight: z.optional(z.number()),
  source: z.optional(z.string()),
  format: z.optional(z.enum(["woff", "woff2"])),
});

export type MintlifyFontDetail = output<typeof fontDetailSchema>;

export const mintlifyFontsSchema = z.union([
  fontDetailSchema,
  z.looseObject({
    heading: z.optional(fontDetailSchema),
    body: z.optional(fontDetailSchema),
  }),
]);

export type MintlifyFonts = output<typeof mintlifyFontsSchema>;

export const mintlifyIntegrationsSchema = z.looseObject({
  amplitude: z.optional(z.looseObject({ apiKey: z.string() })),
  clarity: z.optional(z.looseObject({ projectId: z.string() })),
  fathom: z.optional(z.looseObject({ siteId: z.string() })),
  ga4: z.optional(z.looseObject({ measurementId: z.string() })),
  gtm: z.optional(z.looseObject({ tagId: z.string() })),
  heap: z.optional(z.looseObject({ appId: z.string() })),
  hotjar: z.optional(z.looseObject({ hjid: z.string(), hjsv: z.string() })),
  intercom: z.optional(z.looseObject({ appId: z.string() })),
  koala: z.optional(z.looseObject({ publicApiKey: z.string() })),
  logrocket: z.optional(z.looseObject({ appId: z.string() })),
  mixpanel: z.optional(
    z.looseObject({
      projectToken: z.string(),
      region: z.optional(z.enum(["us", "eu", "in"])),
    }),
  ),
  pirsch: z.optional(z.looseObject({ id: z.string() })),
  plausible: z.optional(
    z.looseObject({
      domain: z.string(),
      server: z.optional(z.string()),
    }),
  ),
  posthog: z.optional(
    z.looseObject({
      apiKey: z.string(),
      apiHost: z.optional(z.string()),
    }),
  ),
  segment: z.optional(z.looseObject({ key: z.string() })),
});

export type MintlifyIntegrations = output<typeof mintlifyIntegrationsSchema>;

export const mintlifyDocsJsonSchema = z.looseObject({
  $schema: z.optional(z.string()),
  // $ref is resolved before validation in readMintlifyDocs().
  theme: z.string(),
  name: z.string(),
  description: z.optional(z.string()),
  colors: z.looseObject({
    primary: hexColor,
    light: z.optional(hexColor),
    dark: z.optional(hexColor),
  }),
  navigation: mintlifyNavigationSchema,
  logo: z.optional(
    z.union([
      z.string(),
      z.looseObject({
        light: z.string(),
        dark: z.string(),
        href: z.optional(z.string()),
      }),
    ]),
  ),
  favicon: z.optional(themedAssetSchema),
  appearance: z.optional(
    z.looseObject({
      default: z.optional(z.enum(["system", "light", "dark"])),
      strict: z.optional(z.boolean()),
    }),
  ),
  background: z.optional(
    z.looseObject({
      image: z.optional(themedAssetSchema),
      decoration: z.optional(z.enum(["gradient", "grid", "windows"])),
      color: z.optional(colorPairSchema),
    }),
  ),
  navbar: z.optional(mintlifyNavbarSchema),
  footer: z.optional(mintlifyFooterSchema),
  banner: z.optional(mintlifyBannerSchema),
  redirects: z.optional(z.array(mintlifyRedirectSchema)),
  api: z.optional(mintlifyApiSchema),
  fonts: z.optional(mintlifyFontsSchema),
  icons: z.optional(
    z.looseObject({
      library: z.optional(z.enum(["fontawesome", "lucide", "tabler"])),
    }),
  ),
  search: z.optional(z.looseObject({ prompt: z.optional(z.string()) })),
  seo: z.optional(
    z.looseObject({
      metatags: z.optional(z.record(z.string(), z.string())),
      indexing: z.optional(z.enum(["navigable", "all"])),
    }),
  ),
  errors: z.optional(
    z.looseObject({
      404: z.optional(
        z.looseObject({
          redirect: z.optional(z.boolean()),
          title: z.optional(z.string()),
          description: z.optional(z.string()),
        }),
      ),
    }),
  ),
  metadata: z.optional(z.looseObject({ timestamp: z.optional(z.boolean()) })),
  integrations: z.optional(mintlifyIntegrationsSchema),
  // parsed for compatibility, not supported by Fumapress (see docs):
  styling: z.optional(
    z.looseObject({
      eyebrows: z.optional(z.enum(["section", "breadcrumbs"])),
      codeblocks: z.optional(z.unknown()),
    }),
  ),
  thumbnails: z.optional(z.looseObject({})),
  interaction: z.optional(z.looseObject({ drilldown: z.optional(z.boolean()) })),
  contextual: z.optional(
    z.looseObject({
      options: z.optional(z.array(z.unknown())),
      display: z.optional(z.enum(["header", "toc"])),
    }),
  ),
  variables: z.optional(z.record(z.string(), z.string())),
  markdown: z.optional(
    z.looseObject({
      schema: z.optional(z.boolean()),
      instructions: z.optional(z.union([z.string(), z.array(z.string())])),
    }),
  ),
});

export type MintlifyNavigation = output<typeof mintlifyNavigationSchema>;
export type MintlifyNavbar = output<typeof mintlifyNavbarSchema>;
export type MintlifyNavbarLink = output<typeof mintlifyNavbarLinkSchema>;
export type MintlifyNavbarPrimary = output<typeof mintlifyNavbarPrimarySchema>;
export type MintlifyRedirect = output<typeof mintlifyRedirectSchema>;
export type MintlifyApiSource = output<typeof mintlifyApiSourceSchema>;
/** @deprecated use `MintlifyApiSource` */
export type MintlifyOpenAPISource = MintlifyApiSource;
export type MintlifyApiConfig = output<typeof mintlifyApiSchema>;
export type MintlifyDocsJson = output<typeof mintlifyDocsJsonSchema>;
export type MintlifyLogo = MintlifyDocsJson["logo"];
export type MintlifyAppearance = MintlifyDocsJson["appearance"];
export type MintlifyBackground = MintlifyDocsJson["background"];
export type MintlifyErrors = MintlifyDocsJson["errors"];
export type MintlifySeo = MintlifyDocsJson["seo"];

export function parseMintlifyDocsJson(input: unknown): MintlifyDocsJson {
  const result = mintlifyDocsJsonSchema.safeParse(input);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`[Fumapress Mintlify] Invalid docs.json:\n${message}`);
  }

  return result.data;
}
