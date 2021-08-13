const compiler = require("@vue/compiler-sfc");
const fs = require("fs");

module.exports = {
  overrides: [
    {
      plugins: ["@babel/plugin-transform-typescript"],
      test(filePath) {
        if (filePath.endsWith(".vue")) {
          const {
            descriptor: { script, scriptSetup },
          } = compiler.parse(fs.readFileSync(filePath, "utf8"));

          if (script && script.lang) {
            return script.lang.toLowerCase() === "ts";
          }

          if (scriptSetup && scriptSetup.lang) {
            return scriptSetup.lang.toLowerCase() === "ts";
          }
        }

        return false;
      },
    },
  ],
};
