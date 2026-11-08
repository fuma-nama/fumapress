"use client";
import type { ReactNode } from "react";
import type { SharedLayoutProps } from "@fumapress/core";
import { HomeShell, useHomeLayoutProps } from "@fumapress/core/ui/home";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";

export interface HomeProps {
  layoutProps: SharedLayoutProps;
  /** render the not found page of Fumadocs UI */
  notFound?: boolean;
  children?: ReactNode;
}

/** the default UI of `HomeLayout.astro`, the not found page in the built-in `HomeShell` like on Waku */
export function Home({ layoutProps, notFound, children }: HomeProps) {
  const props = useHomeLayoutProps(layoutProps);
  if (notFound)
    return (
      <HomeShell layoutProps={layoutProps}>
        <DefaultNotFound />
      </HomeShell>
    );
  return <HomeLayout {...props}>{children}</HomeLayout>;
}
