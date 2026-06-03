import type { ConfigContext } from "@/config";
import type { Awaitable, ServerPlugin } from "@/lib/types";

interface LinkSSGContext {
  links: { href: string; fromPathname: string }[];
}

type ValidateResult = "not-found" | null;

declare global {
  /** server always share the same `global` during build, we can use it to collect pre-rendered links */
  var LINK_SSG_CONTEXT: LinkSSGContext | undefined;
}

export interface LinkValidationOptions {
  /** whether the link is skipped for validation */
  ignored?: (href: string) => boolean;
  /** when external link is discovered */
  externalLink?: (href: string) => Awaitable<ValidateResult>;
}

export function linkValidationPlugin<C extends ConfigContext>(
  options: LinkValidationOptions = {},
): ServerPlugin<C> {
  const { ignored, externalLink } = options;

  return {
    unstable_onServerEntry(entry) {
      const build = entry.build;
      entry.build = async (...args) => {
        const context: LinkSSGContext = (global.LINK_SSG_CONTEXT = { links: [] });
        const res = await build(...args);
        const hrefMap = new Map<string, ValidateResult>();
        for (const link of context.links) hrefMap.set(link.href, null);

        await Promise.all(
          Array.from(hrefMap.keys()).map(async (href) => {
            if (href.startsWith("mailto:") || href.startsWith("#")) return;
            if (ignored && ignored(href)) return;

            // on absolute URL
            if (URL.canParse(href)) {
              if (externalLink) hrefMap.set(href, await externalLink(href));
            } else {
              const res = await entry.fetch(new Request(new URL(href, "http://localhost")));

              if (res.status === 404) hrefMap.set(href, "not-found");
            }
          }),
        );

        const errors: string[] = [];
        for (const link of context.links) {
          const info = hrefMap.get(link.href);
          if (info) errors.push(`In "${link.fromPathname}": link "${link.href}" ${info}`);
        }
        if (errors.length > 0) throw new Error("\n" + errors.join("\n"));

        return res;
      };
      return entry;
    },
  };
}
