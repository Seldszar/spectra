const cf = require("@babel/code-frame");
const ts = require("typescript");

const diagnosticHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

class TypescriptPlugin {
  constructor(options = {}) {
    this.options = {
      fileName: `${options.rootDir ?? ""}tsconfig.json`,
      ...options,
    };
  }

  apply(compiler) {
    const { fileNames, options } = this.parseConfiguration(compiler);

    options.skipLibCheck = true;
    options.noEmit = true;

    const isNormalModule = (input) =>
      input instanceof compiler.webpack.NormalModule;

    compiler.hooks.done.tap("TypescriptPlugin", (stats) => {
      const { compilation } = stats;

      if (compilation.compiler.isChild()) {
        return;
      }

      const entryFiles = new Set(
        fileNames.filter((fileName) => fileName.endsWith(".d.ts"))
      );

      const addEntryFile = (fileName) => {
        if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
          entryFiles.add(fileName);
        }
      };

      compilation.entrypoints.forEach((entrypoint) => {
        if (!entrypoint.isInitial()) {
          return;
        }

        entrypoint.chunks.forEach((chunk) => {
          const modules = compilation.chunkGraph.getChunkModules(chunk);

          modules
            .filter((module) => compilation.chunkGraph.isEntryModule(module))
            .forEach((module) => {
              if (isNormalModule(module.rootModule)) {
                module = module.rootModule;
              }

              module.dependencies.forEach((dependency) => {
                const module = compilation.moduleGraph.getModule(dependency);

                if (isNormalModule(module)) {
                  addEntryFile(module.resource);
                }
              });

              if (isNormalModule(module)) {
                addEntryFile(module.resource);
              }
            });
        });
      });

      const program = ts.createProgram({
        rootNames: Array.from(entryFiles),
        options,
      });

      const diagnostics = ts.getPreEmitDiagnostics(program);

      diagnostics.forEach((diagnostic) => {
        let message = ts.formatDiagnostic(diagnostic, diagnosticHost);

        if (diagnostic.file) {
          const start = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start
          );

          const end = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start + diagnostic.length
          );

          message += cf.codeFrameColumns(
            diagnostic.file.text,
            {
              start: {
                line: start.line + 1,
                column: start.character + 1,
              },
              end: {
                line: end.line + 1,
                column: end.character + 1,
              },
            },
            {
              highlightCode: true,
            }
          );
        }

        switch (diagnostic.category) {
          case ts.DiagnosticCategory.Error:
            return compilation.errors.push(message);

          case ts.DiagnosticCategory.Warning:
            return compilation.warnings.push(message);
        }
      });
    });
  }

  parseConfiguration(compiler) {
    const { config } = ts.readConfigFile(
      this.options.fileName,
      ts.sys.readFile
    );

    return ts.parseJsonConfigFileContent(config, ts.sys, this.options.rootDir ?? compiler.context);
  }
}

module.exports = TypescriptPlugin;
