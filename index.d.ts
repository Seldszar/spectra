/* eslint-disable @typescript-eslint/ban-types */

import Config from "webpack-chain";

export type ConfigHandler = (config: Config, context: Context) => void;

export interface VariantOptions {
  source: string | string[];
  presets?: ConfigHandler[];
  template?: string;
}

export interface Context {
  name: string;
  options: VariantOptions;
  isProduction: boolean;
  isWatching: boolean;
}

export interface Options {
  variants: Record<string, VariantOptions>;
  webpack?: ConfigHandler;
}

export function configure(options: Options): Function;
