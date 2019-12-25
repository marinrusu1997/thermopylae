"use strict";

const build = require('@marin/lib.module-builder/lib/build');
const test = require('@marin/lib.module-builder/lib/test').test;
const coverage = require('@marin/lib.module-builder/lib/coverage');
const clean = require('@marin/lib.module-builder/lib/clean');
const gulp = require('gulp');

module.exports = {
  build: build.buildFactory('TS', gulp),
  test,
  clean: clean.clean,
  purge: clean.purge,

  coverage: coverage.coverageFactory('TS', gulp),
  coverageShow: coverage.coverageShow,
  restoreTestConfig: coverage.restoreTestConfig,
  cleanTranspiledTests: coverage.cleanTranspiledTests
};
