"use client";
import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";
import type { DocsPageProps } from "../config";
import type { ProviderData } from "./content";
import { Provider } from "./provider";

export interface HomeProps extends Pick<DocsPageProps, "layout"> {
  provider: ProviderData;
  /** render the not found page of Fumadocs UI */
  notFound?: boolean;
  children?: ReactNode;
}

/** the island of `HomeLayout.astro` */
export function Home({ provider, layout, notFound, children }: HomeProps) {
  return (
    <Provider provider={provider}>
      <HomeLayout {...layout}>{notFound ? <DefaultNotFound /> : children}</HomeLayout>
    </Provider>
  );
}
