<script setup lang="ts">
import { computed } from "vue";
import type { Components } from "../../core/utils/hast-to-jsx";

const props = withDefaults(defineProps<{ code: string; components?: Partial<Components> }>(), {
  components: () => ({}),
});
const Pre = computed(() => props.components.pre ?? "pre");
const Code = computed(() => props.components.code ?? "code");
</script>

<template>
  <component :is="Pre">
    <component :is="Code">
      <span v-for="(line, i) in code.split('\n')" :key="i" class="line">{{ line }}</span>
    </component>
  </component>
</template>
