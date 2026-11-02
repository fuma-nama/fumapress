import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";
import { jsonToStream } from "@/lib/build-output";

interface LinkSSGContext {
  links: { href: string; fromPathname: string }[];
}

type ValidateResult = "not-found" | null;

/**
 * A build problem, in a shape build platforms can render as a check annotation.
 * `rule` is a free-form identifier so other plugins can report their own without
 * changing the schema.
 */
export interface Diagnostic {
  severity: "error" | "warning";
  /** e.g. `link-validation/not-found` */
  rule: string;
  message: string;
  /** pathname of the page the problem was found on */
  fromPathname?: string;
  href?: string;
}

export interface DiagnosticsFile {
  diagnostics: Diagnostic[];
}

declare global {
  /** server always share the same `global` during build, we can use it to collect pre-rendered links */
  var LINK_SSG_CONTEXT: LinkSSGContext | undefined;
}

export interface LinkValidationOptions {
  /** whether the link is skipped for validation */
  ignored?: (href: string) => boolean;
  /** when external link is discovered */
  externalLink?: (href: string) => Awaitable<ValidateResult>;

  /**
   * How to report broken links:
   *
   * - `throw`: fail the build with an error message.
   * - `json`: write a diagnostics file and let the build succeed.
   * - `both`: write the file, then fail the build.
   *
   * Use `json` or `both` when a deployment platform renders the results,
   * e.g. as annotations on a pull request.
   *
   * @default "throw"
   */
  report?: "throw" | "json" | "both";

  /**
   * File name of the diagnostics file, relative to the build output directory.
   *
   * @default "fumapress-diagnostics.json"
   */
  diagnosticsPath?: string;
}

export function linkValidationPlugin<C extends AppShape>(
  options: LinkValidationOptions = {},
): PressPlugin<C> {
  const {
    ignored,
    externalLink,
    report = "throw",
    diagnosticsPath = "fumapress-diagnostics.json",
  } = options;

  return {
    unstable_onServerEntry(entry) {
      const build = entry.build;
      entry.build = async (utils, ...args) => {
        const context: LinkSSGContext = (global.LINK_SSG_CONTEXT = { links: [] });
        const res = await build(utils, ...args);
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

        const diagnostics: Diagnostic[] = [];
        for (const link of context.links) {
          const info = hrefMap.get(link.href);
          if (!info) continue;

          diagnostics.push({
            severity: "error",
            rule: `link-validation/${info}`,
            message: `link "${link.href}" ${info}`,
            fromPathname: link.fromPathname,
            href: link.href,
          });
        }

        // always emit when reporting as JSON, so consumers can tell
        // "no problems" apart from "validation didn't run"
        if (report !== "throw") {
          await utils.emitFile(
            diagnosticsPath,
            jsonToStream({ diagnostics } satisfies DiagnosticsFile),
          );
        }

        if (report !== "json" && diagnostics.length > 0) {
          throw new Error(
            "\n" +
              diagnostics.map((item) => `In "${item.fromPathname}": ${item.message}`).join("\n"),
          );
        }

        return res;
      };
      return entry;
    },
  };
}
