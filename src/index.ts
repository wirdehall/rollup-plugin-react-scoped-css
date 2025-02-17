/* eslint-disable no-useless-escape */
import { resolve, dirname } from "path";
import { xxHash32 } from "js-xxhash";
import { createFilter, FilterPattern } from "@rollup/pluginutils";
import { generate } from "escodegen";
import { addHashAttributesToJsxTagsAst } from "./ast-program";
import { scopeCss } from "./css/scope-css";

import type { Plugin } from "rollup";

const getFilenameFromPath = (filePath: string) => {
  const parts = filePath.split("/");
  return parts[parts.length - 1].split("?")[0];
};

const getHashFromPath = (filePath: string) => {
  const search = "?scope=";
  const hash = filePath.slice(filePath.indexOf(search) + search.length);
  return hash;
};

const generateHash = (input: string, seed = 0) => {
  const hashNum = xxHash32(Buffer.from(input, "utf8"), seed);
  return hashNum.toString(16);
};

export interface ReactScopedCssPluginOptions {
  /**
   * Which files should be included and parsed by the plugin
   * Default: undefined
   */
  include?: FilterPattern;

  /**
   * Which files should be exluded and that should not be parsed by the plugin
   * Default: undefined
   */
  exclude?: FilterPattern;

  /**
   * If you want to customize the stylesheet file pattern
   * if undefined or '' is passed, all files will be evaluated
   * Default: 'scoped'
   */
  styleFileSuffix?: string;

  /**
   * If you want to customize the attribute prefix that is added to the jsx elements
   * Default: 'v'
   */
  hashPrefix?: string;

  /**
   * If you want to customize the stylesheet extensions
   * Default: ['scss', 'css', 'sass', 'less']
   */
  styleFileExtensions?: string[];

  /**
   * If you have jsx in other file extensions
   * Default: ['jsx', 'tsx']
   */
  jsxFileExtensions?: string[];
}

export interface VitePartialPlugin extends Plugin {
  enforce?: "pre" | "post";
}

export function reactScopedCssPlugin(
  optionsIn: ReactScopedCssPluginOptions = {}
): VitePartialPlugin[] {
  console.warn(
    `This plugin version is in alpha stage and not yet stable. Use at your own risk.
    For a more stable version, use the rollup-plugin-react-scoped-css@0 package.`
  );

  const options: Partial<ReactScopedCssPluginOptions> = {
    hashPrefix: "v",
    styleFileSuffix: "scoped",
    styleFileExtensions: ["scss", "css", "sass", "less"],
    jsxFileExtensions: ["jsx", "tsx"],
    ...optionsIn,
  };

  if (!options.styleFileExtensions || !options.styleFileExtensions.length) {
    throw new Error("You need to provide at least one style file extension");
  }

  if (!options.jsxFileExtensions || !options.jsxFileExtensions.length) {
    throw new Error("You need to provide at least one jsx file extension");
  }

  const filter = createFilter(options.include, options.exclude);
  const scopedCssRegex = options.styleFileSuffix
    ? new RegExp(
        `\.${options.styleFileSuffix}\.(${options.styleFileExtensions.join(
          "|"
        )})$`
      )
    : new RegExp(`\.(${options.styleFileExtensions.join("|")})$`);
  const scopedCssInFileRegex = options.styleFileSuffix
    ? new RegExp(
        `\.${options.styleFileSuffix}\.(${options.styleFileExtensions.join(
          "|"
        )})(\"|\')`
      )
    : new RegExp(`\.(${options.styleFileExtensions.join("|")})(\"|\')`);
  const jsxRegex = new RegExp(`\.(${options.jsxFileExtensions.join("|")})$`);

  return [
    {
      name: "rollup-plugin-react-scoped-css:pre",
      resolveId(source, importer) {
        if (!importer) {
          return;
        }

        if (scopedCssRegex.test(source) && jsxRegex.test(importer)) {
          const importerHash = generateHash(importer);
          const url = resolve(
            dirname(importer),
            `${source}?scope=${importerHash}`
          );
          return url;
        }
      },
      enforce: "pre",
    },
    {
      name: "rollup-plugin-react-scoped-css:post",
      transform(code, id) {
        if (!filter(id)) {
          return;
        }

        if (scopedCssInFileRegex.test(code)) {
          const importerHash = generateHash(id);
          const program = this.parse(code);
          const newAst = addHashAttributesToJsxTagsAst(
            program,
            `data-${options.hashPrefix}-${importerHash}`
          );
          return generate(newAst);
        }

        if (scopedCssRegex.test(getFilenameFromPath(id))) {
          const importerHash = getHashFromPath(id);
          return scopeCss(
            code,
            getFilenameFromPath(id),
            `data-${options.hashPrefix}-${importerHash}`
          );
        }
      },
    },
  ];
}
