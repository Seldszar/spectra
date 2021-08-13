const { configure } = require("../..");

const { EntryWrapperPlugin } = require("@seldszar/yael");
const { VueLoaderPlugin } = require("vue-loader");

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
  webpack(config, { name }) {
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

    config.resolve.extensions.add(".vue");
  },
});
