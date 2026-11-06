import type { ComponentType, ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { createPressIsland } from "@/island/island";

export function Card({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <section data-card="">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Box({ icon: Icon }: { icon: ComponentType }) {
  return (
    <div data-box="">
      <Icon />
    </div>
  );
}

/** the MDX components of `virtual:fumapress/island` */
export const components = { Card, Box } satisfies MDXComponents;

/** the island of `virtual:fumapress/island` */
export const PressIsland = createPressIsland(components);
