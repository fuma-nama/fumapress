"use client";
import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { BaseOptions } from "../press";

/** the Home Layout around content: plugin views and the 404 page */
export function HomeShell({
  baseOptions,
  children,
}: {
  baseOptions: BaseOptions;
  children: ReactNode;
}) {
  return (
    <HomeLayout {...baseOptions}>
      <div
        data-fd-home-layout-container=""
        className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto"
      >
        {children}
      </div>
    </HomeLayout>
  );
}
