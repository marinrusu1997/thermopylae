"use strict";
const fs = require("fs");
const spawn = require("child_process").spawn;
const constants = require('./constants');

function stageTsConfig(done) {
  fs.readFile("tsconfig.json", "utf8", (err, content) => {
    if (err) {
      done(err);
    }

    const config = JSON.parse(content);
    const testIndex = config.include.indexOf("test/**/*.ts");
    if (!testIndex) {
      done(new Error(("test directory not found in include files")));
    }

    config.include.splice(testIndex, 1);
    config.compilerOptions.rootDir = 'lib';

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function transpile() {
  const tsc = spawn("tsc", [], constants.SPAWN_OPTIONS);
  tsc.on("close", code => {
    if (code !== 0) {
      unStageTsConfig(err => {
        throw err;
      });
    }
  });
  return tsc;
}

function unStageTsConfig(done) {
  fs.readFile("tsconfig.json", "utf8", (err, content) => {
    if (err) {
      done(err);
    }

    const config = JSON.parse(content);
    config.include.push("test/**/*.ts");
    config.compilerOptions.rootDir = '.';

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function buildFactory(module, gulp) {
  if (module === constants.ModuleLang.TS) {
    return gulp.series(stageTsConfig, transpile, unStageTsConfig);
  }
}

module.exports = {
  buildFactory
};
