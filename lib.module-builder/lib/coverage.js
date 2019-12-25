"use strict";
const fs = require("fs");
const spawn = require("child_process").spawn;
const npmRun = require("npm-run");
const del = require("del");
const constants = require('./constants');

const SPAWN_OPTIONS = constants.SPAWN_OPTIONS;

function backupTestConfig(done) {
  fs.rename(".mocharc.json", ".mocharc.json.bk", err => {
    if (err) {
      return done(err);
    }

    fs.rename(".nycrc", ".nycrc.bk", err => {
      if (err) {
        fs.renameSync(".mocharc.json.bk", ".mocharc.json");
        return done(err);
      }

      done();
    });
  });
}

function restoreTestConfig(done) {
  del.sync(['.mocharc.json', '.nycrc']);
  fs.rename(".mocharc.json.bk", ".mocharc.json", err => {
    if (err) {
      return done(err);
    }

    fs.rename(".nycrc.bk", ".nycrc", done);
  });
}

function createCoverageConfig(done) {
  const mocha = {
    "exit": true,
    "color": true,
    "recursive": true,
    "timeout": "5s",
    "require": "esm",
    "spec": [
      "test/**/*.spec.js"
    ]
  };
  const nyc = {
    "include": [
      "lib/**/*.js"
    ],
    "exclude": [
      "test/**/*.spec.js",
      "lib/**/*.d.ts"
    ],
    "extension": [".js"],
    "reporter": [
      "html",
      "text",
      "text-summary"
    ],
    "require": [
      "esm"
    ],
    "check-coverage": false,
    "cache": true,
    "instrument": true
  };

  fs.writeFile('.mocharc.json', JSON.stringify(mocha, null, 4), err => {
    if (err) {
      return done(err);
    }

    fs.writeFile('.nycrc', JSON.stringify(nyc, null, 4), done);
  });
}

function transpileTests() {
  const testFiles = fs.readdirSync('test', 'utf8')
    .filter(path => /^(?!.*test\.ts).*\.ts$/.test(path))
    .map(path => `test/${path}`);
  const tsc = npmRun.spawn('tsc', ['--esModuleInterop', ...testFiles], SPAWN_OPTIONS);
  tsc.on('close', code => {
    if (code !== 0) {
      restoreTestConfig(err => {
        throw err;
      });
    }
  });

  return tsc;
}

function runCoverageTests() {
  return npmRun.spawn("nyc", ["mocha"], SPAWN_OPTIONS);
}

function coverageShow() {
  return spawn("http-server", ["coverage/"], SPAWN_OPTIONS);
}

function cleanTranspiledTests() {
  return del(['test/**/*.js', 'lib/**/*.js']);
}


function coverageFactory(module, gulp) {
   if (module === constants.ModuleLang.TS) {
      return gulp.series(backupTestConfig, createCoverageConfig, transpileTests, runCoverageTests, restoreTestConfig, cleanTranspiledTests);
   }
}

module.exports = {
  coverageFactory,
  coverageShow,
  restoreTestConfig,
  cleanTranspiledTests
};
