"use strict";

const buildWithDeclarationsFileFactory = require('@marin/lib.module-builder/lib/build').buildWithDeclarationsFileFactory;
const test = require('@marin/lib.module-builder/lib/test').test;
const coverage = require('@marin/lib.module-builder/lib/coverage');
const clean = require('@marin/lib.module-builder/lib/clean');
const gulp = require('gulp');

module.exports = {
  build: buildWithDeclarationsFileFactory('TS', gulp),
  test,
  clean: clean.clean,
  purge: clean.purge,

  coverage: coverage.coverageFactory('TS', gulp),
  coverageShow: coverage.coverageShow
};
