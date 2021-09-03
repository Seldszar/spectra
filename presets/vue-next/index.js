const compiler = require("@vue/compiler-sfc");
const fs = require("fs");

const { VueLoaderPlugin } = require("vue-loader");

module.exports = (config) => {
  const babelRule = config.module.rule("babel");
  const vueRule = config.module.rule("vue");

  vueRule.test(/\.vue$/);
  vueRule.exclude.add(/node_modules/);
  vueRule.use("vue-loader").loader(require.resolve("vue-loader"));

  config.plugin("vue-loader-plugin").use(VueLoaderPlugin);

  babelRule.use("babel-loader").tap((options) => {
    if (options.overrides == null) {
      options.overrides = [];
    }

    options.overrides.push({
      plugins: [require.resolve("@babel/plugin-transform-typescript")],
      test(filePath) {
        if (filePath.endsWith(".vue")) {
          const {
            descriptor: { script, scriptSetup },
          } = compiler.parse(fs.readFileSync(filePath, "utf8"));

          if (script && script.lang) {
            return script.lang.toLowerCase() === "ts";
          }

          if (scriptSetup && scriptSetup.lang) {
            return scriptSetup.lang.toLowerCase() === "ts";
          }
        }

        return false;
      },
    });

    return options;
  });

  config.resolve.extensions.add(".vue");
};
