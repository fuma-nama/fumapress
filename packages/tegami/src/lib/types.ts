import type { ReactNode } from "react";

export interface ChangelogEntryView {
  url: string;
  title: string;
  description?: string;
  date: Date;
  packages: { name: string; version: string }[];
  body: ReactNode;
}
