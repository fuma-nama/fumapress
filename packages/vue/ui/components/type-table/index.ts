import type { VNode } from "vue";

export { default as TypeTable } from "./TypeTable.vue";

export interface ParameterNode {
  name: string;
  description: string | VNode;
}

export interface TypeNode {
  /**
   * Additional description of the field
   */
  description?: string | VNode;

  /**
   * type signature (short)
   */
  type: string | VNode;

  /**
   * type signature (full)
   */
  typeDescription?: string | VNode;

  /**
   * Optional `href` for the type
   */
  typeDescriptionLink?: string;

  default?: string | VNode;

  required?: boolean;
  deprecated?: boolean;

  /**
   * a list of parameters info if the type is a function.
   */
  parameters?: ParameterNode[];

  returns?: string | VNode;
}
