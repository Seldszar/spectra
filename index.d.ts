/* eslint-disable @typescript-eslint/ban-types */

import Config from "webpack-chain";

declare namespace configure {
  interface VariantOptions {
    source: string | string[];
    template?: string;
  }

  interface Context {
    options: VariantOptions;
    name: string;
  }

  interface Options {
    variants: Record<string, VariantOptions>;
    webpack?: (config: Config, context: Context) => void;
  }
}

declare function configure(options: configure.Options): Function;

export = configure;
