"use strict";

const fs = require("fs");
const spawn = require("child_process").spawn;
const constants = require('../../constants');

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
    config.compilerOptions.module = 'commonjs';

    fs.writeFile("tsconfig.json", JSON.stringify(config, null, 4), done);
  });
}

function stagePackageJson(done) {
  fs.readFile("package.json", "utf8", (err, content) => {
    if (err) {
      done(err);
    }

    const pkg = JSON.parse(content);
    if (pkg.exports == null) {
      pkg.exports = pkg.main.startsWith('./') ? pkg.main : `./${pkg.main}`;
    }

    if (pkg.type == null) {
      pkg.type = 'commonjs';
    }

    fs.writeFile("package.json", JSON.stringify(pkg, null, 4), done);
  });
}

function tscVersion() {
  const tsc = spawn("tsc", ['--version'], constants.SPAWN_OPTIONS);
  tsc.on("close", code => {
    if (code !== 0) {
        throw new Error(`tsc --version exit code ${code}.`);
    }
  });
  return tsc;
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
    return gulp.series(stageTsConfig, stagePackageJson, tscVersion, transpile, unStageTsConfig);
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
