import defaultMdxComponents from "fumadocs-ui/mdx";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { ImageZoom, type ImageZoomProps } from "fumadocs-ui/components/image-zoom";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import type { MDXComponents } from "mdx/types";
import { DocsCategory } from "./docs-category";
import { Flow, FlowStep } from "./flow";
import { Layer, Nesting } from "./nesting";

export default {
  ...defaultMdxComponents,
  img: (props) => <ImageZoom {...(props as ImageZoomProps)} />,
  Accordion,
  Accordions,
  File,
  Files,
  Folder,
  Step,
  Steps,
  Tab,
  Tabs,
  TypeTable,
  DocsCategory,
  Flow,
  FlowStep,
  Layer,
  Nesting,
} satisfies MDXComponents;
