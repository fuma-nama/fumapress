"use client";
import { GlassLayout, type GlassLayoutProps } from "fumadocs-ui/layouts/glass";
import { AISearch, AISearchPanel, useAISearchContext } from "./search";

function Layout({ children, ...props }: GlassLayoutProps) {
  const { open, setOpen } = useAISearchContext();

  return (
    <GlassLayout {...props} aiChat={{ open, onOpenChange: setOpen }}>
      <AISearchPanel />
      {children}
    </GlassLayout>
  );
}

export function GlassAILayout(props: GlassLayoutProps) {
  return (
    <AISearch>
      <Layout {...props} />
    </AISearch>
  );
}
