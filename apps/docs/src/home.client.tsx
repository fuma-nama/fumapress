"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { TerminalIcon } from "lucide-react";

const commands = {
  npm: "npm create fumapress",
  pnpm: "pnpm create fumapress",
  yarn: "yarn create fumapress",
  bun: "bunx create-fumapress",
};

export function AutoSetupCommand() {
  return (
    <Tabs
      defaultValue="npm"
      className="mt-auto -mx-6 -mb-12 px-6 py-4 text-sm border-t bg-fd-card text-fd-card-foreground md:-mx-12 md:-mb-24 md:px-8.5"
    >
      <TabsList className="flex flex-row mb-4 border w-fit rounded-lg items-center text-fd-muted-foreground bg-fd-muted shadow-md">
        {Object.keys(commands).map((name) => (
          <TabsTrigger
            key={name}
            value={name}
            className="px-2 py-1 rounded-lg font-medium font-mono hover:text-fd-accent-foreground hover:bg-fd-accent data-[state=active]:text-fd-primary data-[state=active]:bg-fd-primary/10"
          >
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {Object.entries(commands).map(([name, cmd]) => (
        <TabsContent key={name} value={name}>
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
        </TabsContent>
      ))}
    </Tabs>
  );
}
