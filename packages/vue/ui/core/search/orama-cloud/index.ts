// The record type of the index, read by the Orama Cloud client. Syncing the index (`sync()`, `syncI18n()`,
// `toDocuments()`) runs on the server with the source and isn't ported.

export interface OramaIndex {
  id: string;

  title: string;
  url: string;

  tag?: string;

  /**
   * The id of page, used for `group by`
   */
  page_id: string;

  /**
   * Heading content
   */
  section?: string;

  breadcrumbs?: string[];

  /**
   * Heading (anchor) id
   */
  section_id?: string;

  content: string;
  table?: string;
}
