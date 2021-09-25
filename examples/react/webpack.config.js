const { configure } = require("@spectra/webpack");

module.exports = configure({
  variants: {
    extension: {
      source: "src/extension/index.ts",
    },
    dashboard: {
      source: "src/browser/dashboard/views/*.tsx",
      template: "src/browser/dashboard/template.html",
      presets: [require("@spectra/preset-react")],
    },
    graphics: {
      source: "src/browser/graphics/views/*.tsx",
      template: "src/browser/graphics/template.html",
      presets: [require("@spectra/preset-react")],
    },
  },
});
