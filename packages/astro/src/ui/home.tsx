"use client";
import type { ReactNode } from "react";
import type { DefaultPageProps } from "@fumapress/core/runtime";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";

export interface HomeProps extends Pick<DefaultPageProps, "baseOptions"> {
  /** render the not found page of Fumadocs UI */
  notFound?: boolean;
  children?: ReactNode;
}

/** the default UI of views, pages of plugins and `HomeLayout.astro` */
export function Home({ baseOptions, notFound, children }: HomeProps) {
  return <HomeLayout {...baseOptions}>{notFound ? <DefaultNotFound /> : children}</HomeLayout>;
}
