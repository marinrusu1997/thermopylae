"use strict";

const fs = require("fs");
const spawn = require("child_process").spawn;
const npmRun = require("npm-run");
const constants = require('../../constants');

const SPAWN_OPTIONS = constants.SPAWN_OPTIONS;

function stageTsConfig(done) {
  fs.readFile("tsconfig.json", "utf8", (err, content) => {
    if (err) {
      done(err);
    }

    const config = JSON.parse(content);
    const testIndex = config.include.indexOf("test/**/*.ts");
    if (!testIndex) {
        config.include.push("test/**/*.ts");
    }
    config.compilerOptions.module = 'commonjs'; // just to be sure nothing breaks

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function unStageTsConfig(done) {
  fs.readFile("tsconfig.json", "utf8", (err, content) => {
    if (err) {
      done(err);
    }

    const config = JSON.parse(content);
    config.compilerOptions.module = 'commonjs'; // we stick with commonjs for the moment

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function runCoverageTests() {
  return npmRun.spawn("nyc", ["mocha"], SPAWN_OPTIONS);
}

function coverageShow() {
  return spawn("http-server", ["coverage/"], SPAWN_OPTIONS);
}

function coverageFactory(module, gulp) {
   if (module === constants.ModuleLang.TS) {
      return gulp.series(stageTsConfig, runCoverageTests, unStageTsConfig);
   }
}

module.exports = {
  coverageFactory,
  coverageShow
};
