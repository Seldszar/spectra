const { generateDtsBundle } = require("dts-bundle-generator");
const { ConcatSource } = require("webpack-sources");

class DeclarationPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("DeclarationPlugin", (compilation) => {
      compilation.hooks.additionalAssets.tap("DeclarationPlugin", () => {
        compilation.entrypoints.forEach((entrypoint) => {
          const bundles = generateDtsBundle(
            entrypoint.origins.map((origin) => ({
              filePath: origin.request,
              noCheck: true,
              output: {
                noBanner: true,
              },
            }))
          );

          const source = new ConcatSource(...bundles);

          for (const file of entrypoint.getFiles()) {
            compilation.emitAsset(file.replace(/\.[^.]+$/i, ".d.ts"), source);
          }
        });
      });
    });
  }
}

module.exports = DeclarationPlugin;
