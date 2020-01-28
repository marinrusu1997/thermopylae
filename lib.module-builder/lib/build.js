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
    if (!config.include.includes("lib/**/*.ts")) {
        config.include.push('lib/**/*.ts');
    }

    const testIndex = config.include.indexOf("test/**/*.ts");
    if (testIndex !== -1) {
        config.include.splice(testIndex, 1);
    }

    config.compilerOptions.rootDir = 'lib';
    config.compilerOptions.target = 'esnext';
    config.compilerOptions.module = 'esnext';

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
    config.include = ["lib/**/*.ts", "test/**/*.ts"];
    config.compilerOptions.rootDir = '.';

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function buildFactory(module, gulp) {
  if (module === constants.ModuleLang.TS) {
    return gulp.series(stageTsConfig, transpile, unStageTsConfig);
  }
}

function buildWithDeclarationsFileFactory(module, gulp) {
  return function buildWithDeclarationFiles(done) {
    const buildModuleTask = buildFactory(module, gulp);
    const copyDeclarationFiles = () => gulp.src(['lib/**/*.d.ts']).pipe(gulp.dest('dist'));
    const buildTask = gulp.series(buildModuleTask, copyDeclarationFiles);
    buildTask();
    done();
  };
}

module.exports = {
  buildFactory,
  buildWithDeclarationsFileFactory
};
