import { z, type output, type ZodMiniType } from "zod/mini";

/**
 * Mintlify docs.json schema.
 *
 * Based on https://www.mintlify.com/docs/organize/settings-reference
 *
 * Only properties currently used by @fumapress/mintlify are enabled.
 * Unsupported properties are commented out for future backports.
 */

const hexColor = z.string();

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
  expanded?: boolean;
  hidden?: boolean;
}

const mintlifyGroupSchema: ZodMiniType<MintlifyGroup> = z.lazy(() =>
  z.looseObject({
    group: z.string(),
    pages: z.optional(z.array(mintlifyNavEntrySchema)),
    icon: z.optional(iconSchema),
    root: z.optional(z.string()),
    expanded: z.optional(z.boolean()),
    hidden: z.optional(z.boolean()),
    // tag: z.optional(z.string()),
    // public: z.optional(z.boolean()),
    // boost: z.optional(z.number()),
    // directory: z.optional(z.enum(["none", "accordion", "card"])),
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
});

export const mintlifyTabSchema = z.looseObject({
  tab: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  menu: z.optional(z.array(mintlifyMenuItemSchema)),
  icon: z.optional(iconSchema),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
  // iconType: z.optional(z.string()),
  // searchable: z.optional(z.boolean()),
  // align: z.optional(z.enum(["start", "end"])),
  // directory: z.optional(z.enum(["none", "accordion", "card"])),
});

export const mintlifyAnchorSchema = z.looseObject({
  anchor: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
  // iconType: z.optional(z.string()),
  // color: z.optional(z.looseObject({ light: hexColor, dark: hexColor })),
  // directory: z.optional(z.enum(["none", "accordion", "card"])),
});

export const mintlifyDropdownSchema = z.looseObject({
  dropdown: z.string(),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
  // iconType: z.optional(z.string()),
  // color: z.optional(z.looseObject({ light: hexColor, dark: hexColor })),
  // description: z.optional(z.string()),
  // directory: z.optional(z.enum(["none", "accordion", "card"])),
});

export const mintlifyProductSchema = z.looseObject({
  product: z.string(),
  name: z.optional(z.string()),
  pages: z.optional(z.array(mintlifyNavEntrySchema)),
  groups: z.optional(z.array(mintlifyGroupSchema)),
  icon: z.optional(iconSchema),
  href: z.optional(z.string()),
  hidden: z.optional(z.boolean()),
  // iconType: z.optional(z.string()),
  // color: z.optional(z.looseObject({ light: hexColor, dark: hexColor })),
  // description: z.optional(z.string()),
  // directory: z.optional(z.enum(["none", "accordion", "card"])),
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
    // directory: z.optional(z.enum(["none", "accordion", "card"])),
  }),
);

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
  // banner: z.optional(z.looseObject({ content: z.string() })),
  // footer: z.optional(z.looseObject({})),
  // navbar: z.optional(z.looseObject({})),
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
  // directory: z.optional(z.enum(["none", "accordion", "card"])),
});

export const mintlifyNavbarLinkSchema = z.looseObject({
  label: z.optional(z.string()),
  href: z.string(),
  type: z.optional(z.union([z.literal("github"), z.literal("discord"), z.string()])),
  icon: z.optional(iconSchema),
  // iconType: z.optional(z.string()),
});

export const mintlifyNavbarSchema = z.looseObject({
  links: z.optional(z.array(mintlifyNavbarLinkSchema)),
  primary: z.optional(mintlifyNavbarLinkSchema),
});

export const mintlifyRedirectSchema = z.looseObject({
  source: z.string(),
  destination: z.string(),
  permanent: z.optional(z.boolean()),
});

export const mintlifyOpenAPISourceSchema = z.union([
  z.string(),
  z.looseObject({
    source: z.string(),
    directory: z.optional(z.string()),
  }),
]);

export const mintlifyApiSchema = z.looseObject({
  openapi: z.optional(z.union([mintlifyOpenAPISourceSchema, z.array(mintlifyOpenAPISourceSchema)])),
  asyncapi: z.optional(
    z.union([mintlifyOpenAPISourceSchema, z.array(mintlifyOpenAPISourceSchema)]),
  ),
  playground: z.optional(
    z.looseObject({
      // display: z.optional(z.enum(["interactive", "simple", "none", "auth"])),
      proxy: z.optional(z.boolean()),
      // credentials: z.optional(z.boolean()),
    }),
  ),
  // params: z.optional(z.looseObject({
  //   expanded: z.optional(z.enum(["all", "closed"])),
  //   post: z.optional(z.array(z.string())),
  // })),
  url: z.optional(z.literal("full")),
  // examples: z.optional(z.looseObject({
  //   languages: z.optional(z.array(z.string())),
  //   defaults: z.optional(z.enum(["required", "all"])),
  //   prefill: z.optional(z.boolean()),
  //   autogenerate: z.optional(z.boolean()),
  // })),
  // mdx: z.optional(z.looseObject({
  //   auth: z.optional(z.looseObject({
  //     method: z.optional(z.enum(["bearer", "basic", "key", "cobo"])),
  //     name: z.optional(z.string()),
  //   })),
  //   server: z.optional(z.union([z.string(), z.array(z.string())])),
  // })),
});

export const mintlifyDocsJsonSchema = z.looseObject({
  $schema: z.optional(z.string()),
  // $ref is resolved before validation in readMintlifyDocs().
  theme: z.string(),
  name: z.string(),
  colors: z.looseObject({
    primary: hexColor,
    // light: z.optional(hexColor),
    // dark: z.optional(hexColor),
  }),
  navigation: mintlifyNavigationSchema,
  description: z.optional(z.string()),
  navbar: z.optional(mintlifyNavbarSchema),
  redirects: z.optional(z.array(mintlifyRedirectSchema)),
  api: z.optional(mintlifyApiSchema),
  // logo: z.optional(z.union([
  //   z.string(),
  //   z.looseObject({ light: z.string(), dark: z.string(), href: z.optional(z.string()) }),
  // ])),
  // favicon: z.optional(z.union([
  //   z.string(),
  //   z.looseObject({ light: z.string(), dark: z.string() }),
  // ])),
  // appearance: z.optional(z.looseObject({
  //   default: z.optional(z.enum(["system", "light", "dark"])),
  //   strict: z.optional(z.boolean()),
  // })),
  // fonts: z.optional(z.looseObject({
  //   family: z.optional(z.string()),
  //   weight: z.optional(z.number()),
  //   source: z.optional(z.string()),
  //   format: z.optional(z.enum(["woff", "woff2"])),
  //   heading: z.optional(z.looseObject({})),
  //   body: z.optional(z.looseObject({})),
  // })),
  // icons: z.optional(z.looseObject({
  //   library: z.optional(z.enum(["fontawesome", "lucide", "tabler"])),
  // })),
  // background: z.optional(z.looseObject({
  //   decoration: z.optional(z.enum(["gradient", "grid", "windows"])),
  //   color: z.optional(z.looseObject({ light: hexColor, dark: hexColor })),
  //   image: z.optional(z.union([z.string(), z.looseObject({ light: z.string(), dark: z.string() })])),
  // })),
  // styling: z.optional(z.looseObject({
  //   eyebrows: z.optional(z.enum(["section", "breadcrumbs"])),
  //   latex: z.optional(z.boolean()),
  //   codeblocks: z.optional(z.union([z.enum(["system", "dark"]), z.string(), z.looseObject({})])),
  // })),
  // thumbnails: z.optional(z.looseObject({
  //   appearance: z.optional(z.enum(["light", "dark"])),
  //   background: z.optional(z.string()),
  //   fonts: z.optional(z.looseObject({ family: z.string() })),
  // })),
  // footer: z.optional(z.looseObject({
  //   socials: z.optional(z.record(z.string(), z.string())),
  //   links: z.optional(z.array(z.looseObject({
  //     header: z.optional(z.string()),
  //     items: z.array(z.looseObject({ label: z.string(), href: z.string() })),
  //   }))),
  // })),
  // banner: z.optional(z.looseObject({
  //   content: z.string(),
  //   dismissible: z.optional(z.boolean()),
  //   type: z.optional(z.enum(["info", "warning", "critical"])),
  //   color: z.optional(z.union([hexColor, z.looseObject({ light: hexColor, dark: hexColor })])),
  // })),
  // interaction: z.optional(z.looseObject({
  //   drilldown: z.optional(z.boolean()),
  // })),
  // contextual: z.optional(z.looseObject({
  //   options: z.array(z.union([z.string(), z.looseObject({})])),
  //   display: z.optional(z.enum(["header", "toc"])),
  // })),
  // variables: z.optional(z.record(z.string(), z.string())),
  // metadata: z.optional(z.looseObject({
  //   timestamp: z.optional(z.boolean()),
  // })),
  // errors: z.optional(z.looseObject({
  //   404: z.optional(z.looseObject({
  //     redirect: z.optional(z.boolean()),
  //     title: z.optional(z.string()),
  //     description: z.optional(z.string()),
  //   })),
  // })),
  // seo: z.optional(z.looseObject({
  //   indexing: z.optional(z.enum(["navigable", "all"])),
  //   metatags: z.optional(z.record(z.string(), z.string())),
  // })),
  // search: z.optional(z.looseObject({
  //   prompt: z.optional(z.string()),
  // })),
  // integrations: z.optional(z.looseObject({})),
  // markdown: z.optional(z.looseObject({
  //   schema: z.optional(z.boolean()),
  // })),
});

export type MintlifyNavigation = output<typeof mintlifyNavigationSchema>;
export type MintlifyNavbarLink = output<typeof mintlifyNavbarLinkSchema>;
export type MintlifyRedirect = output<typeof mintlifyRedirectSchema>;
export type MintlifyOpenAPISource = output<typeof mintlifyOpenAPISourceSchema>;
export type MintlifyApiConfig = output<typeof mintlifyApiSchema>;
export type MintlifyDocsJson = output<typeof mintlifyDocsJsonSchema>;

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
