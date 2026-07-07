"use client";

import { Tabs } from "@base-ui/react/tabs";
import { TerminalIcon } from "lucide-react";
import type { MagicMoveDifferOptions, MagicMoveRenderOptions } from "@shikijs/magic-move/types";
import { createHighlighterCoreSync } from "shiki/core";
import typescript from "shiki/dist/langs/typescript.mjs";
import vesper from "shiki/dist/themes/vesper.mjs";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const commands = {
  npm: "npm create fumapress",
  pnpm: "pnpm create fumapress",
  yarn: "yarn create fumapress",
  bun: "bunx create-fumapress",
};

export const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  themes: [vesper],
  langs: [typescript],
});

export const magicMoveOptions: MagicMoveRenderOptions & MagicMoveDifferOptions = {
  containerStyle: false,
  duration: 400,
  lineNumbers: true,
  stagger: 0.3,
};

export function AutoSetupCommand() {
  return (
    <Tabs.Root
      defaultValue="npm"
      className="mt-auto -mx-6 -mb-12 px-6 py-4 text-sm border-t bg-fd-card text-fd-card-foreground md:-mx-12 md:-mb-24 md:px-12"
    >
      <Tabs.List className="flex flex-row mb-4 border w-fit rounded-lg items-center text-fd-muted-foreground bg-fd-muted shadow-md">
        {Object.keys(commands).map((name) => (
          <Tabs.Tab
            key={name}
            value={name}
            className="px-2 py-1 rounded-lg font-medium font-mono hover:text-fd-accent-foreground hover:bg-fd-accent data-active:text-fd-primary data-active:bg-fd-primary/10"
          >
            {name}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {Object.entries(commands).map(([name, cmd]) => (
        <Tabs.Panel key={name} value={name}>
          <code className="flex flex-row gap-2 items-center">
            <TerminalIcon className="size-3.5 text-fd-muted-foreground" />
            {cmd}
          </code>
          <pre className="h-[120px] text-xs py-4 overflow-hidden mask-b-from-0 text-fd-muted-foreground">
            {`┌  create-fumapress
│
◇  Where should the Fumapress app be created?
│  my-site
│
◇  Install dependencies with ${name}?
│  No
│
◆  Created my-site
│`}
          </pre>
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
