"use strict";

const tasks = require('./tasks');
const gulp = require('gulp');

module.exports = {
    build: tasks.build.buildWithDeclarationsFileFactory('TS', gulp),

    test: tasks.test.test,
    debug: tasks.test.debug,

    clean: tasks.clean.clean,
    purge: tasks.clean.purge,

    coverage: tasks.coverage.coverageFactory('TS', gulp),
    coverageShow: tasks.coverage.coverageShow,

    stickToMajorSemver: tasks.stickToMajorSemver
};