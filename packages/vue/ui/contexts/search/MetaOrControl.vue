<script setup lang="ts">
import { onMounted, shallowRef } from "vue";

// `⌘` on the server and during hydration
const text = shallowRef("⌘");

onMounted(() => {
  if (/Windows|Linux/i.test(navigator.userAgent)) text.value = "Ctrl";
});
</script>

<template>{{ text }}</template>
