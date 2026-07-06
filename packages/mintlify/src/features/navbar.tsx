import type { LinkItemType } from "fumadocs-ui/layouts/shared";
import type { ReactNode } from "react";
import { renderMintlifyIcon } from "../icons";
import type { MintlifyDocsJson, MintlifyNavbarLink } from "../schema";
import { renderSocialIcon } from "./socials";

function navbarLinkLabel(link: MintlifyNavbarLink): string {
  if (link.label) return link.label;
  if (link.type === "github") return "GitHub";
  if (link.type === "discord") return "Discord";
  return link.href;
}

async function navbarLinkIcon(link: MintlifyNavbarLink): Promise<ReactNode> {
  if (link.icon) return renderMintlifyIcon(link.icon);
  if (link.type === "github" || link.type === "discord") return renderSocialIcon(link.type);
}

/** map `navbar` links & primary CTA in docs.json to Fumadocs link items */
export async function buildNavbarLinks(docs: MintlifyDocsJson): Promise<LinkItemType[]> {
  const links: LinkItemType[] = [];

  for (const link of docs.navbar?.links ?? []) {
    const icon = await navbarLinkIcon(link);
    const label = navbarLinkLabel(link);

    if (!link.label && icon) {
      links.push({
        type: "icon",
        icon,
        text: label,
        label,
        url: link.href,
      });
      continue;
    }

    links.push({
      text: label,
      icon,
      url: link.href,
    });
  }

  const primary = docs.navbar?.primary;
  if (primary) {
    if (primary.type === "button") {
      links.push({
        type: "button",
        text: primary.label ?? primary.href,
        url: primary.href,
      });
    } else {
      links.push({
        type: "icon",
        icon: renderSocialIcon(primary.type),
        text: primary.label ?? navbarLinkLabel(primary),
        label: primary.label ?? primary.type,
        url: primary.href,
      });
    }
  }

  return links;
}

/** `logo` + `name` in docs.json -> Fumadocs `nav.title` / `nav.url` */
export function buildNavTitle(docs: MintlifyDocsJson): { title: ReactNode; url?: string } {
  const logo = docs.logo;
  const imgStyle = { height: "1.75rem", width: "auto" } as const;

  if (typeof logo === "string") {
    return { title: <img src={logo} alt={docs.name} style={imgStyle} /> };
  }

  if (logo) {
    return {
      title: (
        <>
          <img src={logo.light} alt={docs.name} className="mintlify-light" style={imgStyle} />
          <img src={logo.dark} alt={docs.name} className="mintlify-dark" style={imgStyle} />
        </>
      ),
      url: logo.href,
    };
  }

  return { title: docs.name };
}
