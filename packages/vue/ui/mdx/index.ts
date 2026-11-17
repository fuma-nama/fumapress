import { defineComponent, h, type Component } from "vue";
import { Callout, CalloutContainer, CalloutDescription, CalloutTitle } from "../components/callout";
import { Card, Cards } from "../components/card";
import {
  CodeBlock,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  Pre,
} from "../components/codeblock";
import { Heading } from "../components/heading";
import Link from "../core/link";
import Image from "./Image.vue";
import Table from "./Table.vue";

const pre = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(CodeBlock, attrs, () => h(Pre, null, slots.default));
  },
});

function heading(as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(Heading, { as, ...attrs }, slots.default);
    },
  });
}

const defaultMdxComponents = {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  pre,
  Card,
  Cards,
  a: Link,
  img: Image,
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  table: Table,
  Callout,
  CalloutContainer,
  CalloutTitle,
  CalloutDescription,
} satisfies Record<string, Component>;

export const createRelativeLink = (): never => {
  throw new Error("`createRelativeLink` is only supported in Node.js environment");
};

export { defaultMdxComponents as default };
