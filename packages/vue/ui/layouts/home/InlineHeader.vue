<script setup lang="ts">
import { RenderNode } from "../shared";
import { useHomeLayout } from "./context";
import { Header } from "./slots/header";

defineOptions({ inheritAttrs: false });

const { props: layout } = useHomeLayout();
</script>

<template>
  <RenderNode v-if="layout.nav?.component" :node="layout.nav.component" />
  <Header v-else v-bind="$attrs" />
</template>
