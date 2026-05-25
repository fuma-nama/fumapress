import type { SchemaTypeDefinition } from "sanity";
import { docsType } from "./docsType";
import { blockContent, callout, card, cards } from "../lib/sanity/base";
import { file, files, folder } from "../lib/sanity/files";
import { tab, tabs } from "../lib/sanity/tabs";
import { step, steps } from "../lib/sanity/steps";
import { accordion, accordions } from "../lib/sanity/accordion";

export const schemaTypes = [
  blockContent,
  callout,
  card,
  cards,
  docsType,
  files,
  folder,
  file,
  tabs,
  tab,
  accordions,
  accordion,
  steps,
  step,
] satisfies SchemaTypeDefinition[];
