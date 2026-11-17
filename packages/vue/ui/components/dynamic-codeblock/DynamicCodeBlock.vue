<script setup lang="ts">
import { DynamicCodeBlock as Base } from "../dynamic-codeblock.core";
import { getHighlighter } from "./highlighter";
import type { DynamicCodeblockProps } from "./index";

withDefaults(defineProps<DynamicCodeblockProps>(), { wrapInSuspense: true });
</script>

<template>
  <Base
    :highlighter="getHighlighter"
    :options="options ?? {}"
    :lang="lang"
    :code="code"
    :codeblock="codeblock"
    :wrap-in-suspense="wrapInSuspense"
  />
</template>
