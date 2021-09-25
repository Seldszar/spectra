const { JSDOM } = require("jsdom");
const path = require("path");

const formatString = (input, data) =>
  input.replace(/\[(\w+)]/g, (_, key) => data[key]);

class PagePlugin {
  constructor(options = {}) {
    this.options = {
      resourceHandlers: [
        {
          test: /\.css$/,
          handler: (request) => [
            {
              tagName: "link",
              target: "head",
              attributes: {
                href: request,
                rel: "stylesheet",
              },
            },
          ],
        },
        {
          test: /\.js$/,
          handler: (request) => [
            {
              tagName: "script",
              target: "body",
              attributes: {
                src: request,
              },
            },
          ],
        },
        {
          test: /\.mjs$/,
          handler: (request) => [
            {
              tagName: "script",
              target: "body",
              attributes: {
                src: request,
                type: "module",
              },
            },
          ],
        },
      ],
      ...options,
    };
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap("PagePlugin", (compilation) => {
      compilation.hooks.additionalAssets.tap("PagePlugin", async () => {
        const entryNames = [...compilation.entrypoints.keys()];

        let {
          options: { pages },
        } = this;

        if (typeof pages === "function") {
          pages = await pages(entryNames);
        }

        if (typeof pages === "object" && !Array.isArray(pages)) {
          pages = {
            filename: "[name].html",
            entrypoints: ["[name]"],
            hash: false,
            ...pages,
          };

          pages = entryNames.map((name) => {
            const r = (value) =>
              Array.isArray(value)
                ? value.map(r)
                : formatString(value, { name });

            return {
              ...pages,
              template: r(pages.template),
              filename: r(pages.filename),
              entrypoints: r(pages.entrypoints),
            };
          });
        }

        pages.forEach((page) => {
          const pageContent = this.getPageContent(compilation, page);

          compilation.assets[page.filename] = {
            size: () => pageContent.length,
            source: () => pageContent,
          };
        });
      });
    });
  }

  getPageResources(compilation, page) {
    const resources = [];

    const {
      options: { resourceHandlers },
    } = this;

    page.entrypoints.forEach((name) => {
      const entrypoint = compilation.entrypoints.get(name);

      if (!entrypoint) {
        throw new RangeError(`Entry point "${name}" not found`);
      }

      entrypoint.chunks.forEach((chunk) => {
        const handleFile = (file) => {
          const resourceHandler = resourceHandlers.find(({ test }) =>
            test.test(file)
          );

          if (!resourceHandler) {
            return;
          }

          let request = this.resolveChunkRequest(compilation, page, file);

          if (page.hash) {
            request += `${request.includes("?") ? "&" : "?"}${chunk.hash}`;
          }

          resources.push(...resourceHandler.handler(request));
        };

        chunk.auxiliaryFiles.forEach(handleFile);
        chunk.files.forEach(handleFile);
      });
    });

    return resources;
  }

  getPageContent(compilation, page) {
    const dom = new JSDOM(page.template);

    const {
      window: { document },
    } = dom;

    const resources = this.getPageResources(compilation, page);

    resources.forEach(({ attributes, tagName, target }) => {
      const node = document.createElement(tagName);

      for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
      }

      let targetElement = document.querySelector(target);

      if (!targetElement) {
        targetElement = document.appendChild(document.createElement(target));
      }

      targetElement.append(node);
    });

    if (page.title) {
      document.title = page.title;
    }

    return dom.serialize();
  }

  getPublicPath(compilation, page) {
    if (page.publicPath) {
      return page.publicPath;
    }

    return compilation.getAssetPath(compilation.outputOptions.publicPath, {
      hash: compilation.hash,
    });
  }

  getAssetPath(compilation, filename, options) {
    return compilation.getAssetPath(filename, options);
  }

  resolveChunkRequest(compilation, page, chunkFile) {
    let basePath = this.getPublicPath(compilation, page);

    if (basePath === "" || basePath === "auto") {
      const pagePath = this.getAssetPath(compilation, page.filename, {
        hash: compilation.hash,
      });

      const pageOutputPath = path.resolve(
        compilation.outputOptions.path,
        path.dirname(pagePath)
      );

      basePath = path
        .relative(pageOutputPath, compilation.outputOptions.path)
        .replace(/\\/g, "/");
    }

    if (basePath.length > 0 && !basePath.endsWith("/")) {
      basePath += "/";
    }

    return `${basePath}${chunkFile}`;
  }
}

module.exports = PagePlugin;
