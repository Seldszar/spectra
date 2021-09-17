const cf = require("@babel/code-frame");
const path = require("path");
const ts = require("typescript");

const diagnosticHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

const embeddedParsers = [
  {
    test: /\.vue$/,
    parse(fileName, sourceText) {
      let script;

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

      return (
        script && {
          content: getEmbededContent(sourceText, script),
          extension: getExtensionByLang(script.lang),
          fileName,
        }
      );
    },
  },
];

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

const getEmbededContent = (sourceText, { end, src, start }) => {
  if (src) {
    src = src.replace(/\.tsx?$/i, "");

    const lines = [
      `export { default } from "${src}";`,
      `export * from "${src}";`,
    ];

    return lines.join(ts.sys.newLine);
  }

  return (
    Array(sourceText.slice(0, start).split(/\r?\n/g).length).join(
      ts.sys.newLine
    ) + sourceText.slice(start, end)
  );
};

class TypescriptPlugin {
  constructor(options = {}) {
    this.options = {
      configFile: "tsconfig.json",
      ...options,
    };
  }

  apply(compiler) {
    if (compiler.isChild()) {
      return;
    }

    const { fileNames, options } = this.parseConfiguration(compiler);

    options.skipLibCheck = true;
    options.noEmit = true;

    const isNormalModule = (input) =>
      input instanceof compiler.webpack.NormalModule;

    compiler.hooks.done.tap("TypescriptPlugin", (stats) => {
      const { compilation } = stats;

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

      const embeddedSources = new Map();

      const getEmbeddedSource = (fileName) => {
        let source = embeddedSources.get(fileName);

        if (source == null) {
          const parser = embeddedParsers.find((parser) =>
            parser.test.test(fileName)
          );

          if (parser) {
            source = parser.parse(fileName, readFile(fileName));
          }

          embeddedSources.set(fileName, source);
        }

        return source;
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
        if (diagnostic.file) {
          const embeddedFile = readEmbeddedFile(diagnostic.file.fileName);

          if (embeddedFile) {
            diagnostic.file.fileName = embeddedFile.fileName;
          }
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
      this.options.configFile,
      ts.sys.readFile
    );

    const {
      options: { basePath = compiler.context },
    } = this;

    return ts.parseJsonConfigFileContent(config, ts.sys, basePath);
  }
}

module.exports = TypescriptPlugin;
