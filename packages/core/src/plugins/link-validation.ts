import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";

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

/** validate the links rendered in prerendered pages, after the build */
export function linkValidationPlugin<
  C extends AppShape = AppShape,
  Ctx extends Context<C> = Context<C>,
>(options: LinkValidationOptions = {}): Plugin<C, Ctx> {
  const {
    ignored,
    externalLink,
    report = "throw",
    diagnosticsPath = "fumapress-diagnostics.json",
  } = options;

  return {
    async build({ links, fetch, emitFile }) {
      const hrefMap = new Map<string, ValidateResult>();
      for (const link of links) hrefMap.set(link.href, null);

      await Promise.all(
        Array.from(hrefMap.keys()).map(async (href) => {
          if (href.startsWith("mailto:") || href.startsWith("#")) return;
          if (ignored && ignored(href)) return;

          // on absolute URL
          if (URL.canParse(href)) {
            if (externalLink) hrefMap.set(href, await externalLink(href));
          } else {
            const res = await fetch(new Request(new URL(href, "http://localhost")));

            if (res.status === 404) hrefMap.set(href, "not-found");
          }
        }),
      );

      const diagnostics: Diagnostic[] = [];
      for (const link of links) {
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
        await emitFile(
          diagnosticsPath,
          JSON.stringify({ diagnostics } satisfies DiagnosticsFile, null, 2),
        );
      }

      if (report !== "json" && diagnostics.length > 0) {
        throw new Error(
          "\n" + diagnostics.map((item) => `In "${item.fromPathname}": ${item.message}`).join("\n"),
        );
      }
    },
  };
}
