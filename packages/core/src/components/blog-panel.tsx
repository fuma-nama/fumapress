"use client";

import type { TOCItemType } from "fumadocs-core/toc";
import { TOCProvider, TOCScrollArea, useTOCItems } from "fumadocs-ui/components/toc";
import { ReactNode, useState } from "react";
import { TOCItem, TOCItems } from "fumadocs-ui/components/toc/clerk";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "fumadocs-ui/components/ui/collapsible";
import { ChevronDown, ShareIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { cva } from "class-variance-authority";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { useTranslations } from "@/components/i18n";

const panelButtonVariants = cva(
  "inline-flex items-center font-medium gap-2 px-3 py-2 transition-all duration-150 rounded-lg hover:text-fd-accent-foreground hover:bg-fd-accent active:scale-95",
);

export function BlogPanel() {
  const t = useTranslations();
  const items = useTOCItems();
  const [open, setOpen] = useState(false);
  const [isSuccessful, onCopy] = useCopyButton(() => {
    if (navigator.share) {
      return navigator.share({ title: document.title, url: location.href });
    } else {
      return navigator.clipboard.writeText(location.href);
    }
  });

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="fixed w-full max-w-[calc(100%---spacing(4))] left-1/2 -translate-x-1/2 bottom-2 border shadow-md text-sm bg-fd-secondary/80 backdrop-blur-sm z-20 p-1 rounded-xl sm:max-w-[400px] sm:bottom-4"
    >
      <CollapsibleContent>
        <TOCScrollArea className="max-h-[min(600px,calc(100vh---spacing(30)))]">
          <TOCItems>
            {items.map((item) => (
              <TOCItem key={item.url} item={item} onClick={() => setOpen(false)} />
            ))}
          </TOCItems>
        </TOCScrollArea>
      </CollapsibleContent>
      <div className="flex flex-row gap-2">
        <CollapsibleTrigger className={cn(panelButtonVariants(), "min-w-0")}>
          <span className="truncate">{t.tableOfContents}</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-fd-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <button
          className={cn(panelButtonVariants(), "ms-auto text-fd-muted-foreground")}
          onClick={onCopy}
        >
          <ShareIcon className="size-3.5 shrink-0" />
          {isSuccessful ? t.copied : t.share}
        </button>
      </div>
    </Collapsible>
  );
}
export function BlogProvider({ toc, children }: { toc: TOCItemType[]; children: ReactNode }) {
  return <TOCProvider toc={toc}>{children}</TOCProvider>;
}
