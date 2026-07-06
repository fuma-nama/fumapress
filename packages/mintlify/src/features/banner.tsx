import { Banner } from "fumadocs-ui/components/banner";
import type { ReactNode } from "react";
import type { MintlifyBanner } from "../schema";
import { renderInlineMarkdown } from "./markdown";

/**
 * Announcement banner (`banner` in docs.json), shown across the top of every
 * page. Colors are provided by the theme CSS (`.mintlify-banner` rules).
 */
export function MintlifyBannerBar({ banner }: { banner: MintlifyBanner }): ReactNode {
  return (
    <Banner
      // `id` enables the dismiss button; derive it from content so that a new
      // announcement shows up again after the previous one was dismissed.
      id={banner.dismissible ? `mintlify-banner-${hash(banner.content)}` : undefined}
      variant="normal"
      className="mintlify-banner"
    >
      <span>{renderInlineMarkdown(banner.content)}</span>
    </Banner>
  );
}

function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
