export interface SortedResult<Content = string> {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: Content;

  /**
   * breadcrumbs to be displayed on UI
   */
  breadcrumbs?: Content[];

  /** the table of a table row, unique in its page */
  table?: string;
}
