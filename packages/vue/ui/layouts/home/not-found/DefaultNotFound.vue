<script setup lang="ts">
import { HomeIcon } from "../../../icons";
import { buttonVariants } from "../../../components/ui/button";
import { Link } from "../../../core/link";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

/**
 * the default not found page content, please make your own if you want to customize it.
 */
const t = useTranslations({ note: "404 not found page" });
const buttonClass = cn(
  buttonVariants({
    className: "mt-4 gap-1.5",
    variant: "default",
  }),
);
</script>

<template>
  <div class="flex flex-col px-8 justify-center flex-1 text-center items-center gap-4">
    <h1 class="text-6xl font-bold text-fd-muted-foreground">404</h1>
    <h2 class="text-2xl font-semibold">{{ t("Page Not Found") }}</h2>
    <p class="text-fd-muted-foreground max-w-md">
      {{
        t(
          "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.",
        )
      }}
    </p>
    <Link href="/" :class="buttonClass"> <HomeIcon class="size-4" />{{ t("Back to Home") }} </Link>
  </div>
</template>
