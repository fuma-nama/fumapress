<script setup lang="ts">
import { inject, useAttrs } from "vue";
import { cn } from "../../utils/cn";
import { CodeBlock, Pre } from "../codeblock";
import { PropsKey } from "./context";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const extraProps = inject(PropsKey, undefined);

/** read while rendering: attributes are not reactive */
function codeblockProps() {
  const extra = extraProps?.value;
  return {
    ...attrs,
    ...extra,
    class: cn("my-0", attrs.class as string | undefined, extra?.class),
  };
}
</script>

<template>
  <CodeBlock v-bind="codeblockProps()">
    <Pre><slot /></Pre>
  </CodeBlock>
</template>
