const { preset } = require("../..");

const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");

module.exports = preset((config, context) => {
  if (config.get("target") !== "web") {
    return;
  }

  const babelRule = config.module.rule("babel");

  babelRule.use("babel-loader").tap((options) => ({
    ...options,
    presets: [...options.presets, require.resolve("@babel/preset-react")],
  }));

  if (context.isWatching) {
    babelRule.use("babel-loader").tap((options) => ({
      ...options,
      plugins: [...options.plugins, require.resolve("react-refresh/babel")],
    }));

    config.plugin("react-refresh-plugin").use(ReactRefreshWebpackPlugin);
  }
});
