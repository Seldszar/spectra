const ws = require("ws");

const servers = new Map();

class RefreshPlugin {
  constructor(options = {}) {
    this.options = {
      address: "0.0.0.0",
      port: 45678,
      ...options,
    };
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap("RefreshPlugin", (compilation) => {
      const { name, outputOptions } = compilation;

      Object.assign(outputOptions, {
        hotUpdateChunkFilename: `${name}.[id].hot-update.js`,
        hotUpdateMainFilename: `[runtime]-${name}.hot-update.json`,
      });
    });

    compiler.hooks.done.tap("RefreshPlugin", (stats) => {
      const info = stats.toJson("errors-warnings");

      this.broadcast(compiler, "done", {
        warnings: info.warnings,
        errors: info.errors,
        hash: stats.hash,
      });

      if (stats.hasErrors()) {
        return;
      }

      this.broadcast(compiler, "replace", {
        hash: stats.hash,
      });
    });

    compiler.hooks.watchRun.tap("RefreshPlugin", () => {
      const key = JSON.stringify({
        address: this.options.address,
        port: this.options.port,
      });

      let server = servers.get(key);

      if (!server) {
        const serverOptions = {
          host: this.options.address,
          port: this.options.port,
        };

        server = new ws.Server(serverOptions, () => {
          const logger = compiler.getInfrastructureLogger("RefreshPlugin");
          const info = server.address();

          logger.log("Server is now listening %s:%d", info.address, info.port);
        });

        servers.set(key, server);
      }

      this.server = server;
    });

    const {
      webpack: { DefinePlugin, HotModuleReplacementPlugin },
    } = compiler;

    const hrmPlugin = new HotModuleReplacementPlugin();
    const definePlugin = new DefinePlugin({
      __REFRESH_PLUGIN__: JSON.stringify(this.getClientOptions(compiler)),
    });

    hrmPlugin.apply(compiler);
    definePlugin.apply(compiler);
  }

  broadcast(compiler, type, data) {
    if (!this.server) {
      return;
    }

    this.server.clients.forEach((client) => {
      if (client.readyState !== ws.OPEN) {
        return;
      }

      client.send(JSON.stringify([compiler.name, type, data]));
    });
  }

  getClientOptions(compiler) {
    const clientOptions = {
      name: compiler.options.name,
      port: this.options.port,
    };

    if (this.options.address !== "0.0.0.0") {
      clientOptions.address = this.options.address;
    }

    return clientOptions;
  }
}

module.exports = RefreshPlugin;
