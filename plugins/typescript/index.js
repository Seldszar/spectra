const cf = require("@babel/code-frame");
const path = require("path");
const ts = require("typescript");

const diagnosticHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

class TypescriptPlugin {
  constructor(options = {}) {
    this.options = {
      fileName: "tsconfig.json",
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

      const embeddedSources = new Map();

      const entryFiles = new Set(
        fileNames.filter((fileName) => fileName.endsWith(".d.ts"))
      );

      const host = ts.createCompilerHost(options);

      const { fileExists, readFile } = host;

      const parseEmbeddedFileName = (fileName) => {
        const extension = path.extname(fileName);
        const embeddedFileName = fileName.slice(0, -extension.length);
        const embeddedExtension = path.extname(embeddedFileName);

        return {
          extension,
          embeddedFileName,
          embeddedExtension,
        };
      };

      const getExtensionByLang = (lang) => {
        if (typeof lang === "string") {
          lang = lang.toLowerCase();
        }

        switch (lang) {
          case "ts":
            return ".ts";

          case "tsx":
            return ".tsx";

          case "jsx":
            return ".jsx";
        }

        return ".js";
      };

      const readEmbeddedFile = (fileName) => {
        const { embeddedFileName, extension } = parseEmbeddedFileName(fileName);

        if (fileExists(embeddedFileName)) {
          const embeddedSource = getEmbeddedSource(embeddedFileName);

          if (embeddedSource.extension === extension) {
            return embeddedSource;
          }
        }

        return null;
      };

      const getEmbeddedSource = (fileName) => {
        let embeddedSource = embeddedSources.get(fileName);

        if (embeddedSource == null) {
          let script;

          const sourceText = readFile(fileName);

          try {
            const compiler = require("@vue/compiler-sfc");

            const { descriptor } = compiler.parse(sourceText, {
              pad: "space",
            });

            if (descriptor.script) {
              const {
                script: { loc, lang, src },
              } = descriptor;

              const start = loc.start.offset;
              const end = loc.end.offset;

              script = { end, lang, src, start };
            }
          } catch {
            const compiler = require("vue-template-compiler");

            const parsed = compiler.parseComponent(sourceText, {
              pad: "space",
            });

            script = parsed.script;
          }

          embeddedSource = {
            content: "export default {};",
            extension: ".js",
            fileName,
          };

          if (script) {
            let { end, lang, src, start } = script;

            if (src) {
              src = src.replace(/\.tsx?$/i, "");

              const text = [
                `export { default } from "${src}";`,
                `export * from "${src}";`,
              ].join("\n");

              embeddedSource.content = text;
            } else {
              const text = `${Array(
                sourceText.slice(0, start).split(/\r?\n/g).length
              ).join("\n")}${sourceText.slice(start, end)}`;

              embeddedSource.content = text;
            }

            embeddedSource.extension = getExtensionByLang(lang);
          }

          embeddedSources.set(fileName, embeddedSource);
        }

        return embeddedSource;
      };

      host.fileExists = (fileName) => {
        const embeddedFile = readEmbeddedFile(fileName);

        if (embeddedFile) {
          return true;
        }

        return fileExists(fileName);
      };

      host.readFile = (fileName) => {
        const embeddedFile = readEmbeddedFile(fileName);

        if (embeddedFile) {
          return embeddedFile.content;
        }

        return readFile(fileName);
      };

      const addEntryFile = (fileName) => {
        if (fileName.endsWith(".vue")) {
          const embeddedSource = getEmbeddedSource(fileName);

          if (embeddedSource) {
            entryFiles.add(`${fileName}${embeddedSource.extension}`);
          }
        }

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
        host,
      });

      const diagnostics = ts.getPreEmitDiagnostics(program);

      diagnostics.forEach((diagnostic) => {
        const embeddedFile = readEmbeddedFile(diagnostic.file.fileName);

        if (embeddedFile) {
          diagnostic.file.fileName = embeddedFile.fileName;
        }

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

    return ts.parseJsonConfigFileContent(config, ts.sys, compiler.context);
  }
}

module.exports = TypescriptPlugin;
