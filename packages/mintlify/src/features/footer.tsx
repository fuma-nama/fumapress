import type { CSSProperties, ReactNode } from "react";
import type { MintlifyFooter } from "../schema";
import { renderSocialIcon } from "./socials";

/**
 * Site footer (`footer` in docs.json): link columns + social links.
 *
 * Styled with inline styles on top of Fumadocs CSS variables so it works
 * without any Tailwind setup for this package.
 */

const columnHeaderStyle: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-fd-foreground)",
  marginBottom: "0.75rem",
};

const linkStyle: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-fd-muted-foreground)",
  textDecoration: "none",
};

export function MintlifyFooterBar({ footer }: { footer: MintlifyFooter }): ReactNode {
  const socials = Object.entries(footer.socials ?? {});
  const columns = footer.links ?? [];

  if (socials.length === 0 && columns.length === 0) return null;

  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid var(--color-fd-border)",
        backgroundColor: "var(--color-fd-card)",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "2.5rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {columns.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fit, minmax(10rem, ${columns.length > 2 ? "1fr" : "16rem"}))`,
              gap: "2rem",
            }}
          >
            {columns.map((column, i) => (
              <nav key={i} aria-label={column.header ?? "Footer"}>
                {column.header && <p style={columnHeaderStyle}>{column.header}</p>}
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {column.items.map((item, j) => (
                    <li key={j}>
                      <a href={item.href} style={linkStyle}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        )}

        {socials.length > 0 && (
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {socials.map(([platform, href]) => (
              <a
                key={platform}
                href={href}
                aria-label={platform}
                rel="noreferrer noopener"
                target="_blank"
                style={{ color: "var(--color-fd-muted-foreground)", display: "inline-flex" }}
              >
                {renderSocialIcon(platform)}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
