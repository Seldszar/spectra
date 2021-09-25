const fg = require("fast-glob");
const path = require("path");

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function normalizeEntryOptions(entry) {
  if (typeof entry === "string") {
    return {
      import: [entry],
    };
  }

  if (Array.isArray(entry)) {
    return {
      import: entry,
    };
  }

  return {
    ...entry,
    import: entry.import && toArray(entry.import),
    dependOn: entry.dependOn && toArray(entry.dependOn),
  };
}

function getEntryName(basePath, entryPath) {
  const parsedPath = path.parse(path.relative(basePath, entryPath));
  const entryName = path.join(parsedPath.dir, parsedPath.name);

  return entryName.replace(/\\/g, "/");
}

function getCompilerTask(compiler, task) {
  return {
    basePath: path.join(compiler.context, task.base),
    stream: () =>
      fg.stream(task.patterns, {
        fs: compiler.inputFileSystem,
        cwd: compiler.context,
      }),
  };
}

function getCompilerTasks(compiler, tasks) {
  return tasks.map((task) => getCompilerTask(compiler, task));
}

class EntryPlugin {
  constructor(source, options = {}) {
    this.source = source;
    this.options = options;

    this.tasks = fg.generateTasks(source);
  }

  apply(compiler) {
    const compilerTasks = getCompilerTasks(compiler, this.tasks);

    compiler.hooks.afterCompile.tap("EntryPlugin", (compilation) => {
      for (const compilerTask of compilerTasks) {
        compilation.contextDependencies.add(compilerTask.basePath);
      }
    });

    const {
      options: { entry },
    } = compiler;

    const managedEntries = new WeakSet();

    compiler.options.entry = async () => {
      const result = typeof entry === "function" ? await entry() : entry;

      for (const [name, entry] of Object.entries(result)) {
        if (!managedEntries.has(entry)) {
          continue;
        }

        delete result[name];
      }

      await Promise.all(
        compilerTasks.map(async (compilerTask) => {
          const entries = compilerTask.stream();

          for await (let entry of entries) {
            let name = getEntryName(compilerTask.basePath, entry);

            if (entry[0] !== ".") {
              entry = `./${entry}`;
            }

            if ("format" in this.options) {
              [name, entry] = this.options.format(name, entry);
            }

            managedEntries.add((result[name] = normalizeEntryOptions(entry)));
          }
        })
      );

      return result;
    };
  }
}

module.exports = EntryPlugin;
