
"use strict";

const build = require('@marin/lib.module-builder/lib/build');
const test = require('@marin/lib.module-builder/lib/test').test;
const coverage = require('@marin/lib.module-builder/lib/coverage');
const clean = require('@marin/lib.module-builder/lib/clean');
const gulp = require('gulp');

const buildWithJsonSchemas = done => {
    const buildModuleTask = build.buildFactory('TS', gulp);
    const copyJsonSchemas = () => gulp.src(['lib/schemas/**/*.json']).pipe(gulp.dest('dist/schemas'));
    const buildTask = gulp.series(buildModuleTask, copyJsonSchemas);
    buildTask();
    done();
};

module.exports = {
  build: buildWithJsonSchemas,
  test,
  clean: clean.clean,
  purge: clean.purge,

  coverage: coverage.coverageFactory('TS', gulp),
  coverageShow: coverage.coverageShow,
  restoreTestConfig: coverage.restoreTestConfig,
  cleanTranspiledTests: coverage.cleanTranspiledTests
};
