import type { FC } from "react";
import type { MintlifyErrors } from "../schema";
import { renderInlineMarkdown } from "./markdown";

/**
 * `errors.404` from docs.json.
 *
 * Following Mintlify semantics, unknown pages redirect to the home page by
 * default; set `errors.404.redirect: false` to display a 404 page instead
 * (optionally with custom `title` / `description`).
 */
export function createMintlifyNotFound(
  errors: MintlifyErrors | undefined,
  fallback: FC<{ lang?: string }>,
): FC<{ lang?: string }> {
  const config = errors?.["404"];

  if (config?.redirect !== false) {
    return function MintlifyNotFoundRedirect({ lang }) {
      const home = lang ? `/${lang}` : "/";

      return (
        <>
          {/* React 19 hoists meta tags into <head> */}
          <meta httpEquiv="refresh" content={`0;url=${home}`} />
          <script
            dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(home)});` }}
          />
        </>
      );
    };
  }

  if (!config.title && !config.description) return fallback;

  return function MintlifyNotFound() {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          flex: 1,
          gap: "1rem",
          padding: "4rem 1.5rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{config.title ?? "Page not found"}</h1>
        {config.description && (
          <p style={{ color: "var(--color-fd-muted-foreground)", maxWidth: "32rem" }}>
            {renderInlineMarkdown(config.description)}
          </p>
        )}
        <a
          href="/"
          style={{
            color: "var(--color-fd-primary)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Back to home
        </a>
      </main>
    );
  };
}
