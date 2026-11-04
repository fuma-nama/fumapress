"use client";
import type { ReactNode } from "react";
import type { DefaultPageProps } from "@fumapress/core/runtime";
import { HomeShell } from "@fumapress/core/runtime/ui";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";

export interface HomeProps extends Pick<DefaultPageProps, "baseOptions"> {
  /** render the not found page of Fumadocs UI */
  notFound?: boolean;
  children?: ReactNode;
}

/** the default UI of `HomeLayout.astro`, the not found page in the built-in `HomeShell` like on Waku */
export function Home({ baseOptions, notFound, children }: HomeProps) {
  if (notFound)
    return (
      <HomeShell baseOptions={baseOptions}>
        <DefaultNotFound />
      </HomeShell>
    );
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}
