const path = require("path");

const escapeString = (input) =>
  input.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");

const createRegExp = (input) => escapeString(input).replace(/\\\*/g, "(\\S*)");

const matchPattern = (pattern, input) => input.match(createRegExp(pattern));

class AliasResolvePlugin {
  constructor(baseUrl, paths) {
    this.baseUrl = baseUrl || ".";
    this.paths = paths || {};
  }

  apply(resolver) {
    const target = resolver.ensureHook("resolve");
    const hook = resolver.getHook("described-resolve");

    hook.tapPromise("AliasResolvePlugin", async (request, resolveContext) => {
      const { request: moduleName } = request;

      if (moduleName.endsWith(".d.ts") || path.isAbsolute(moduleName)) {
        return;
      }

      for (const [prefix, prefixPaths] of Object.entries(this.paths)) {
        const matches = matchPattern(prefix, moduleName);

        if (matches == null) {
          continue;
        }

        for (const prefixPath of prefixPaths) {
          const matchedPath = prefixPath.replace("*", matches[1]);
          const candidate = path.resolve(
            request.descriptionFileRoot,
            this.baseUrl,
            matchedPath
          );

          const [error, result] = await new Promise((resolve) => {
            const object = { ...request, request: candidate };
            const message = `aliased with mapping '${prefix}': '${moduleName}' to '${candidate}'`;
            const callback = (error, result) => resolve([error, result]);

            resolver.doResolve(
              target,
              object,
              message,
              resolveContext,
              callback
            );
          });

          if (error || result == null) {
            continue;
          }

          return result;
        }
      }
    });
  }
}

module.exports = AliasResolvePlugin;
