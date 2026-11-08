import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types";

export default {
  ...defaultMdxComponents,
  Tab,
  Tabs,
} satisfies MDXComponents;
