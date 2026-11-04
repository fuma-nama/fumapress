import { type GlobEntry } from "@tailwindcss/oxide";
/** the built-in UI of `@fumapress/core`, which both runtimes render */
export declare const coreUiSource: GlobEntry;
/** the Tailwind classes of the files matching `sources`, as `css/generated.css` for the package's preset */
export declare function compilePresetCss(...sources: GlobEntry[]): Promise<void>;
