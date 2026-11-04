import { accordionComponents } from "@/components/sanity/accordion";
import { baseBlocks, baseComponents, baseMarks } from "@/components/sanity/base";
import { filesComponents } from "@/components/sanity/files";
import { stepsComponents } from "@/components/sanity/steps";
import { tabsComponents } from "@/components/sanity/tabs";
import { createSanitySource } from "@fumadocs/sanity";
import sanityPlugin from "@fumadocs/sanity/press";
import { createClient } from "@sanity/client";
import { createPress } from "fumapress";

const source = createSanitySource({
  client: createClient({
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET,
    apiVersion: "2024-12-04",
  }),
  docType: "docs",
});

export default createPress(source, {
  loaderOptions: { alwaysRevalidate: true },
})
  .plugins(
    sanityPlugin({
      components: {
        block: baseBlocks,
        types: {
          ...baseComponents,
          ...filesComponents,
          ...tabsComponents,
          ...stepsComponents,
          ...accordionComponents,
        },
        marks: baseMarks,
      },
    }),
  )
  .config({
    mode: "dynamic",
    site: {
      name: "Sanity Example",
    },
  });
