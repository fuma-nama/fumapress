// The record type of the index, read by the Algolia client. Syncing the index (`sync()`, `toDocuments()`) runs on the
// server with the source and isn't ported.

export interface BaseIndex {
  objectID: string;
  title: string;
  url: string;
  tag?: string;

  /**
   * The id of page, used for distinct
   */
  page_id: string;

  /**
   * Heading content
   */
  section?: string;

  /**
   * Heading (anchor) id
   */
  section_id?: string;

  breadcrumbs?: string[];

  content: string;
  table?: string;
}
