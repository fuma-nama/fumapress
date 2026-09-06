/**
 * The WebAssembly build of Takumi, pass it as `options.module` to `takumiPlugin()` when the native addon can't be loaded.
 *
 * Importing it bundles the binary, so it is a separate entry.
 */
export { default } from "takumi-js/wasm";
