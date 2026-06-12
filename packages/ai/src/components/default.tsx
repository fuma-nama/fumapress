"use client";

import { cn } from "@/lib/cn";
import { useTranslations } from "@fuma-translate/react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { MessageCircleIcon } from "lucide-react";
import { AISearch, AISearchPanel, AISearchTrigger } from "./search";

export function DefaultComponent() {
  const t = useTranslations({ note: "AI chat trigger" });

  return (
    <AISearch>
      <AISearchPanel />
      <AISearchTrigger
        position="float"
        className={cn(
          buttonVariants({
            variant: "secondary",
            className: "text-fd-muted-foreground rounded-2xl",
          }),
        )}
      >
        <MessageCircleIcon className="size-4.5" />
        {t("Ask AI")}
      </AISearchTrigger>
    </AISearch>
  );
}
