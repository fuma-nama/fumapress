export interface CompilePackageTranslationsOptions {
  /**
   * Working directory of the package.
   * @default process.cwd()
   */
  cwd?: string;
  /** Glob patterns relative to `cwd`. */
  input?: string[];
  /**
   * Output path for generated types.
   * @default 'src/.translations/index.ts'
   */
  typesOutput?: string;
  /**
   * Output path for translation keys JSON.
   * @default 'src/.translations/keys.json'
   */
  jsonOutput?: string;
  extraKeys?: string[];
}
export declare function compilePackageTranslations(
  options?: CompilePackageTranslationsOptions,
): Promise<void>;
export declare function packageTranslationsPlugin(options?: CompilePackageTranslationsOptions): {
  name: string;
  buildStart(): Promise<void>;
};
