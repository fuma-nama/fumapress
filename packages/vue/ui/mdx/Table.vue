<script setup lang="ts">
defineOptions({ inheritAttrs: false });
</script>

<template>
  <div class="relative overflow-auto prose-no-margin my-6" tabindex="0">
    <table v-bind="$attrs">
      <slot />
    </table>
  </div>
</template>
