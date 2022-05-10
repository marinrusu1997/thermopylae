"use strict";

const fs = require("fs");
const spawn = require("child_process").spawn;
const npmRun = require("npm-run");
const constants = require('../../constants');
const c8Config = require("../../configs/c8");

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

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function c8ConfigToCommandArgs() {
  const args = [];

  for (const [key, value] of Object.entries(c8Config)) {
    if (typeof value === 'boolean') {
      if (value === true) {
        args.push(`--${key}`);
      }
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      for (const v of value) {
        args.push(`--${key}`, v);
      }
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      args.push(`--${key}`, `${value}`);
      continue;
    }

    throw new Error(`Unknown c8 config property '${key}' having value '${JSON.stringify(value)}'.`);
  }

  return args;
}

function runCoverageTests() {
  return npmRun.spawn("c8", [...c8ConfigToCommandArgs(), "mocha"], SPAWN_OPTIONS);
}

function coverageShow() {
  return spawn("http-server", ["coverage/"], SPAWN_OPTIONS);
}

function coverageFactory(module, gulp) {
   if (module === constants.ModuleLang.TS) {
      return gulp.series(stageTsConfig, runCoverageTests);
   }
}

module.exports = {
  coverageFactory,
  coverageShow
};
