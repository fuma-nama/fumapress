import { defineAsyncComponent, type Component } from "vue";
import { Step, Steps } from "../ui/components/steps";
import { Tab, Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/components/tabs";
import defaultMdxComponents from "../ui/mdx";

/** a component only some pages use: its code is loaded by the pages that render it */
function lazy<M>(load: () => Promise<M>, name: keyof M): Component {
  return defineAsyncComponent(() => load().then((mod) => mod[name] as Component));
}

const accordion = () => import("../ui/components/accordion");
const files = () => import("../ui/components/files");

/** the components of Markdown: the elements Fumadocs UI styles, and its components by name, without an import */
export const components: Record<string, Component> = {
  ...defaultMdxComponents,
  Accordion: lazy(accordion, "Accordion"),
  Accordions: lazy(accordion, "Accordions"),
  File: lazy(files, "File"),
  Files: lazy(files, "Files"),
  Folder: lazy(files, "Folder"),
  ImageZoom: lazy(() => import("../ui/components/image-zoom"), "ImageZoom"),
  Step,
  Steps,
  Tab,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TypeTable: lazy(() => import("../ui/components/type-table"), "TypeTable"),
};
