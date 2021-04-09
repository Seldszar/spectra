const compiler = require("@vue/compiler-sfc");
const fs = require("fs");

const { EntryWrapperPlugin } = require("@seldszar/yael");
const { VueLoaderPlugin } = require("vue-loader");

const configure = require("../..");

module.exports = configure({
  variants: {
    extension: {
      source: "src/extension/index.ts",
    },
    dashboard: {
      source: "src/browser/dashboard/views/*.vue",
      template: "src/browser/dashboard/template.html",
    },
    graphics: {
      source: "src/browser/graphics/views/*.vue",
      template: "src/browser/graphics/template.html",
    },
  },
  webpack(config, { actions, name }) {
    if (name === "extension") {
      return;
    }

    const vueRule = config.module.rule("vue");

    vueRule.test(/\.vue$/);
    vueRule.exclude.add(/node_modules/);
    vueRule.use("vue-loader").loader("vue-loader");

    config.plugin("vue-loader-plugin").use(VueLoaderPlugin);
    config.plugin("entry-wrapper-plugin").use(EntryWrapperPlugin, [
      {
        template: `src/browser/${name}/template.ts`,
        test: /\.vue$/,
      },
    ]);

    actions.setBabelOverride("vue", {
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
      plugins: ["@babel/plugin-transform-typescript"],
    });

    config.resolve.extensions.add(".vue");
  },
});
