const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");

module.exports = (config, context) => {
  const babelRule = config.module.rule("babel");

  babelRule.use("babel-loader").tap((options) => {
    options.presets.push(require.resolve("@babel/preset-react"));

    if (context.isWatching) {
      options.plugins.push(require.resolve("react-refresh/babel"));
    }

    return options;
  });

  if (context.isWatching) {
    config.plugin("react-refresh-plugin").use(ReactRefreshWebpackPlugin);
  }
};
