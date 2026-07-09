import type { ReactNode } from "react";

export interface ChangelogEntryView {
  url: string;
  title: string;
  description?: string;
  /** ISO date string */
  date: string;
  packages: { name: string; version: string }[];
  body: ReactNode;
}
