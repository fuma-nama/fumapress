<script setup lang="ts">
import { SidebarIcon } from "../../../icons";
import { SidebarCollapseTrigger, useSidebar } from "../../../components/sidebar/base";
import { buttonVariants } from "../../../components/ui/button";
import { cn } from "../../../utils/cn";

const { collapsed } = useSidebar();
const className = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "-ms-2 size-8 text-fd-muted-foreground",
);
</script>

<template>
  <SidebarCollapseTrigger v-if="collapsed" :class="className">
    <SidebarIcon />
  </SidebarCollapseTrigger>
</template>
