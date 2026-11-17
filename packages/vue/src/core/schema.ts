/**
 * The interface of Standard Schema (https://standardschema.dev), which validation libraries like Zod and Valibot
 * implement: written here, so a site needs no package for it.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: readonly Issue[];
  }
  export interface Issue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | PathSegment)[] | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}

type JSONValue = number | boolean | string | null | JSONValue[] | { [key: string]: JSONValue };

/** the frontmatter of a page without a schema: the fields of `pageSchema` of Fumadocs */
export interface DefaultPageData {
  staticParams?: Record<string, string>[];
  title: string;
  description?: string;
  icon?: string;
  full?: boolean;
  _openapi?: Record<string, JSONValue>;
  _asyncapi?: Record<string, JSONValue>;
}

/** a `meta.json` without a schema: the fields of `metaSchema` of Fumadocs */
export interface DefaultMetaData {
  staticParams?: Record<string, string>[];
  title?: string;
  pages?: string[];
  pagesIndex?: string;
  description?: string;
  root?: boolean | string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  icon?: string;
}

/** whether a value has the type of a field */
type Check = (value: unknown) => boolean;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string: Check = (value) => typeof value === "string";
const boolean: Check = (value) => typeof value === "boolean";
const stringOrBoolean: Check = (value) => string(value) || boolean(value);
const strings: Check = (value) => Array.isArray(value) && value.every(string);
const staticParams: Check = (value) =>
  Array.isArray(value) &&
  value.every((item) => isObject(item) && Object.values(item).every(string));

const expected = new Map<Check, string>([
  [string, "a string"],
  [boolean, "a boolean"],
  [stringOrBoolean, "a string or a boolean"],
  [strings, "a list of strings"],
  [staticParams, "a list of objects of strings"],
  [isObject, "an object"],
]);

/**
 * A schema of the listed fields, as Zod's `z.object()` validates: a field is required unless it is optional, and the
 * fields it doesn't list are left out of the output.
 */
function objectSchema<Output>(
  fields: Record<string, [check: Check, optional?: "optional"]>,
): StandardSchemaV1<unknown, Output> {
  return {
    "~standard": {
      version: 1,
      vendor: "fumapress",
      validate(value) {
        if (!isObject(value)) return { issues: [{ message: "expected an object" }] };
        const issues: StandardSchemaV1.Issue[] = [];
        const output: Record<string, unknown> = {};
        for (const [key, [check, optional]] of Object.entries(fields)) {
          const item = value[key];
          if (item === undefined && optional) continue;
          if (check(item)) output[key] = item;
          else {
            const received = item === null ? "null" : Array.isArray(item) ? "array" : typeof item;
            issues.push({
              message: `expected ${expected.get(check)}, received ${received}`,
              path: [key],
            });
          }
        }
        return issues.length > 0 ? { issues } : { value: output as Output };
      },
    },
  };
}

export const defaultPageSchema = objectSchema<DefaultPageData>({
  staticParams: [staticParams, "optional"],
  title: [string],
  description: [string, "optional"],
  icon: [string, "optional"],
  full: [boolean, "optional"],
  _openapi: [isObject, "optional"],
  _asyncapi: [isObject, "optional"],
});

export const defaultMetaSchema = objectSchema<DefaultMetaData>({
  staticParams: [staticParams, "optional"],
  title: [string, "optional"],
  pages: [strings, "optional"],
  pagesIndex: [string, "optional"],
  description: [string, "optional"],
  root: [stringOrBoolean, "optional"],
  defaultOpen: [boolean, "optional"],
  collapsible: [boolean, "optional"],
  icon: [string, "optional"],
});
