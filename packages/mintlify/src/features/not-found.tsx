import {
  getHomeUrl,
  type Context,
  type RouteParams,
  type View,
  type ViewRoute,
} from "@fumapress/core";
import type { MintlifyErrors } from "../schema";
import { renderInlineMarkdown } from "./markdown";

export interface MintlifyViews {
  "mintlify.404": { title: string; description?: string };
}

/**
 * `errors.404` from docs.json, as the view at `/404`.
 *
 * Following Mintlify semantics, unknown pages redirect to the home page by
 * default; set `errors.404.redirect: false` to display a 404 page instead
 * (optionally with custom `title` / `description`).
 */
export function notFoundView(
  ctx: Context,
  errors: MintlifyErrors,
): ViewRoute<MintlifyViews> | undefined {
  const config = errors?.["404"];
  const redirect = config?.redirect !== false;
  if (!redirect && !config?.title && !config?.description) return;

  const props = { title: config?.title ?? "Page not found", description: config?.description };
  return {
    path: "/404",
    async view(
      _: RouteParams,
      { lang }: { lang: string | undefined },
    ): Promise<View<MintlifyViews>> {
      const home = ctx.withBase(await getHomeUrl(ctx, lang));
      return {
        type: "mintlify.404",
        props,
        title: props.title,
        node: redirect ? (
          <>
            {/* React 19 hoists meta tags into <head> */}
            <meta httpEquiv="refresh" content={`0;url=${home}`} />
            <script
              dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(home)});` }}
            />
          </>
        ) : (
          <div
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
            <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{props.title}</h1>
            {props.description && (
              <p style={{ color: "var(--color-fd-muted-foreground)", maxWidth: "32rem" }}>
                {renderInlineMarkdown(props.description)}
              </p>
            )}
            <a
              href={home}
              style={{
                color: "var(--color-fd-primary)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        ),
      };
    },
  };
}
