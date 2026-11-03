"use client";
import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";
import type { DocsPageProps } from "../config";

export interface HomeProps extends Pick<DocsPageProps, "layout"> {
  /** render the not found page of Fumadocs UI */
  notFound?: boolean;
  children?: ReactNode;
}

/** the layout of `HomeLayout.astro`, in the island of the provider */
export function Home({ layout, notFound, children }: HomeProps) {
  return <HomeLayout {...layout}>{notFound ? <DefaultNotFound /> : children}</HomeLayout>;
}
