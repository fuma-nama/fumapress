"use client";
import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { mergeOptions, type SharedLayoutProps } from "../press";
import { useLayoutProps } from "./docs";

/** the layout props the Home Layout takes, the others are of docs layouts */
const homeKeys: Record<Exclude<keyof BaseLayoutProps, "children">, true> = {
  githubUrl: true,
  links: true,
  nav: true,
  slots: true,
  themeSwitch: true,
  searchToggle: true,
  i18n: true,
};

/** the props of the Home Layout: the base options of `useLayoutProps()` over `layoutProps` of the server */
export function useHomeLayoutProps(layoutProps: SharedLayoutProps): BaseLayoutProps {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mergeOptions([useLayoutProps(), layoutProps])))
    if (Object.hasOwn(homeKeys, key)) props[key] = value;
  return props;
}

/** the Home Layout around content: plugin views and the 404 page */
export function HomeShell({
  layoutProps,
  children,
}: {
  /** `props.layoutProps` of `ui.renderPage`, without the page tree */
  layoutProps: SharedLayoutProps;
  children: ReactNode;
}) {
  return (
    <HomeLayout {...useHomeLayoutProps(layoutProps)}>
      <div className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto">{children}</div>
    </HomeLayout>
  );
}
