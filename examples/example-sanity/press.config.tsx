import { accordionComponents } from "@/components/sanity/accordion";
import { baseBlocks, baseComponents, baseMarks } from "@/components/sanity/base";
import { filesComponents } from "@/components/sanity/files";
import { stepsComponents } from "@/components/sanity/steps";
import { tabsComponents } from "@/components/sanity/tabs";
import { fumapressSanity, sanityPlugin } from "@fumapress/sanity";
import { PortableText } from "@portabletext/react";
import { createClient } from "@sanity/client";
import { dynamicLoader } from "fumadocs-core/source/dynamic";
import { defineConfig } from "fumapress";

const sanityClient = createClient({
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET,
});

const sanityIntegration = fumapressSanity({
  client: sanityClient,
  docType: "docs",
  PortableText({ value }) {
    return (
      <PortableText
        value={value}
        components={{
          block: baseBlocks,
          types: {
            ...baseComponents,
            ...filesComponents,
            ...tabsComponents,
            ...stepsComponents,
            ...accordionComponents,
          },
          marks: baseMarks,
        }}
      />
    );
  },
});

const loader = dynamicLoader(sanityIntegration.dynamicSource(), { baseUrl: "/" });

export default defineConfig({
  site: {
    name: "Sanity Example",
  },
  loader: () => loader.get(),
}).usePlugins(sanityPlugin(sanityIntegration));
