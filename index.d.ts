/* eslint-disable @typescript-eslint/ban-types */

import Config from "webpack-chain";

export interface VariantOptions {
  source: string | string[];
  template?: string;
}

export interface Context {
  name: string;
  options: VariantOptions;
  isProduction: boolean;
  isWatching: boolean;
}

export type WebpackHandler = (config: Config, context: Context) => void;

export interface Options {
  variants: Record<string, VariantOptions>;
  webpack?: WebpackHandler;
}

export function preset(handler: WebpackHandler): Function;
export function configure(options: Options): Function;
