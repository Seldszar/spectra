const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const Config = require("webpack-chain");
const nodeExternals = require("webpack-node-externals");

const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const TerserWebpackPlugin = require("terser-webpack-plugin");

const AliasResolvePlugin = require("./plugins/alias-resolve");
const DeclarationPlugin = require("./plugins/declaration");
const EntryPlugin = require("./plugins/entry");
const PagePlugin = require("./plugins/page");
const RefreshPlugin = require("./plugins/refresh");
const TypescriptPlugin = require("./plugins/typescript");

const loadJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath));

exports.configure = (options) => {
  const { dependencies, devDependencies } = loadJsonFile("package.json");

  /**
   * @param {...string} names
   */
  const useDependency = (...names) =>
    names.some((name) => name in dependencies || name in devDependencies);

  const usePostcss = useDependency("postcss");
  const useSass = useDependency("sass", "node-sass");
  const useTypescript = useDependency("typescript");

  /**
   * @param {Config.Rule} config
   * @param {boolean} modules
   * @param {string[]} loaders
   */
  const applyStyleRule = (config, modules, loaders = []) => {
    if (usePostcss) {
      loaders.unshift(require.resolve("postcss-loader"));
    }

    config
      .use("extract-css-loader")
      .loader(MiniCssExtractPlugin.loader)
      .options({
        esModule: false,
      });

    config.use("css-loader").loader(require.resolve("css-loader")).options({
      importLoaders: loaders.length,
      modules,
    });

    loaders.forEach((loader) => {
      config.use(loader).loader(require.resolve(loader));
    });
  };

  return (_, argv) => {
    const isProduction = argv.mode === "production";
    const isWatching = argv.watch;

    const result = [];

    for (const [variantName, variantOptions] of Object.entries(
      options.variants
    )) {
      const config = new Config();

      config
        .name(variantName)
        .context(variantOptions.context)
        .devtool(isProduction ? "source-map" : "inline-cheap-source-map");

      config.performance.set("hints", false);

      config.output
        .path(path.resolve(variantName))
        .set("clean", isProduction)
        .publicPath("");

      config.resolve.extensions.merge([
        ".wasm",
        ".mjs",
        ".jsx",
        ".js",
        ".json",
      ]);

      config.cache({
        type: "filesystem",
        compression: false,
        buildDependencies: {
          config: [__filename, require.main.filename],
        },
      });

      config.set("infrastructureLogging", {
        level: "error",
      });

      config.watchOptions({
        aggregateTimeout: 500,
        ignored: [".git", "node_modules", "dashboard", "extension", "graphics"],
      });

      config.optimization.splitChunks({
        cacheGroups: {
          vendor: {
            name: "vendor",
            chunks: "initial",
            test: /node_modules/,
          },
        },
      });

      config.optimization
        .minimizer("terser-webpack-plugin")
        .use(TerserWebpackPlugin, [
          {
            extractComments: false,
            terserOptions: {
              format: {
                comments: false,
              },
            },
          },
        ]);

      try {
        const { compilerOptions } = loadJsonFile("jsconfig.json");

        config.resolve
          .plugin("jsconfig-alias-resolve-plugin")
          .use(AliasResolvePlugin, [
            compilerOptions.baseUrl,
            compilerOptions.paths,
          ]);
      } catch {} // eslint-disable-line no-empty

      try {
        const { compilerOptions } = loadJsonFile("tsconfig.json");

        config.resolve
          .plugin("tsconfig-alias-resolve-plugin")
          .use(AliasResolvePlugin, [
            compilerOptions.baseUrl,
            compilerOptions.paths,
          ]);
      } catch {} // eslint-disable-line no-empty

      const babelRule = config.module.rule("babel");

      babelRule.test(/\.[jt]sx?$/);
      babelRule.exclude.add(/node_modules/);

      babelRule
        .use("thread-loader")
        .loader(require.resolve("thread-loader"))
        .options({
          workers: 2,
          workerParallelJobs: Infinity,
          poolTimeout: isWatching ? Infinity : 500,
        });

      babelRule
        .use("babel-loader")
        .loader(require.resolve("babel-loader"))
        .options({
          cacheDirectory: true,
          cacheCompression: false,
          plugins: [
            [
              "@babel/plugin-proposal-decorators",
              {
                legacy: true,
              },
            ],
            [
              "@babel/plugin-proposal-class-properties",
              {
                loose: false,
              },
            ],
            [
              "@babel/plugin-transform-runtime",
              {
                corejs: false,
                helpers: true,
                regenerator: true,
              },
            ],
          ],
          presets: [
            [
              "@babel/preset-env",
              {
                targets: variantName === "extension" ? "node 12" : "chrome 75",
                include: [
                  "@babel/plugin-proposal-optional-chaining",
                  "@babel/plugin-proposal-nullish-coalescing-operator",
                ],
              },
            ],
            [
              "@babel/preset-typescript",
              {
                optimizeConstEnums: true,
                allExtensions: true,
                isTSX: true,
              },
            ],
          ],
        });

      if (useTypescript) {
        config.plugin("typescript-plugin").use(TypescriptPlugin);

        config.resolve.extensions.merge([".tsx", ".ts"]);
      }

      switch (variantName) {
        case "dashboard":
        case "graphics": {
          config.target("web");

          const cssRule = config.module.rule("css").test(/\.css$/);

          applyStyleRule(cssRule.oneOf("module").resourceQuery(/module/), true);
          applyStyleRule(cssRule.oneOf("normal"), false);

          applyStyleRule(
            config.module.rule("css-modules").test(/\.module\.css$/),
            true
          );

          if (useSass) {
            const sassRule = config.module.rule("sass").test(/\.s[ac]ss$/);

            applyStyleRule(
              sassRule.oneOf("module").resourceQuery(/module/),
              true,
              ["sass-loader"]
            );
            applyStyleRule(sassRule.oneOf("normal"), false, ["sass-loader"]);

            applyStyleRule(
              config.module.rule("sass-modules").test(/\.module\.s[ac]ss$/),
              true,
              ["sass-loader"]
            );
          }

          config.module
            .rule("assets")
            .test(/\.(png|jpe?g|gif|svg|eot|ttf|woff2?|web[mp])$/)
            .type("asset/resource");

          config.plugin("mini-css-extract-plugin").use(MiniCssExtractPlugin);
          config.plugin("node-polyfill-webpack-plugin").use(NodePolyfillPlugin);

          let template = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
              </head>
            </html>
          `;

          if (variantOptions.template) {
            template = fs.readFileSync(variantOptions.template, "utf-8");
          }

          config.plugin("page-plugin").use(PagePlugin, [
            {
              pages: {
                hash: true,
                template,
              },
            },
          ]);

          if (isWatching) {
            config.plugin("refresh-plugin").use(RefreshPlugin);
          }

          break;
        }

        case "extension": {
          config.target("node").externals(nodeExternals());

          config.output.set("library", {
            type: "commonjs2",
          });

          if (config.get("devtool")) {
            config
              .plugin("source-map-banner-plugin")
              .use(webpack.BannerPlugin, [
                {
                  banner: `require("source-map-support/register");`,
                  entryOnly: true,
                  raw: true,
                },
              ]);
          }

          if (useTypescript && isProduction) {
            config.plugin("declaration-plugin").use(DeclarationPlugin);
          }

          break;
        }
      }

      config.plugin("entry-plugin").use(EntryPlugin, [
        variantOptions.source,
        {
          format(name, entry) {
            entry = [entry];

            if (config.get("target") === "web" && isWatching) {
              entry.unshift(require.resolve("./plugins/refresh/client"));
            }

            return [name, entry];
          },
        },
      ]);

      const handlers = [];

      if (variantOptions.presets) {
        handlers.push(...variantOptions.presets);
      }

      if (options.webpack) {
        handlers.push(options.webpack);
      }

      handlers.forEach((handler) => {
        handler(config, {
          options: variantOptions,
          name: variantName,
          isProduction,
          isWatching,
        });
      });

      result.push({ entry: {}, ...config.toConfig() });
    }

    return result;
  };
};
