const { configure } = require("@spectra/webpack");
const { EntryWrapperPlugin } = require("@seldszar/yael");

module.exports = configure({
  variants: {
    extension: {
      source: "src/extension/index.ts",
    },
    dashboard: {
      source: "src/browser/dashboard/views/*.vue",
      template: "src/browser/dashboard/template.html",
      presets: [require("@spectra/preset-vue-next")],
    },
    graphics: {
      source: "src/browser/graphics/views/*.vue",
      template: "src/browser/graphics/template.html",
      presets: [require("@spectra/preset-vue-next")],
    },
  },
  webpack(config, { name }) {
    if (name === "extension") {
      return;
    }

    config.plugin("entry-wrapper-plugin").use(EntryWrapperPlugin, [
      {
        template: `src/browser/${name}/template.ts`,
        test: /\.vue$/,
      },
    ]);
  },
});
