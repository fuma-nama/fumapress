declare module "virtual:fumapress/renderers" {
  /** the content renderers of the site, the last layer */
  const renderers: import("@fumapress/core").Plugin<import("./press").WakuAppShape>[];
  export default renderers;
}
