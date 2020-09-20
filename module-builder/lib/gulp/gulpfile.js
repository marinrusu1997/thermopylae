"use strict";

const tasks = require('./tasks');
const gulp = require('gulp');

module.exports = {
    build: tasks.build.buildWithDeclarationsFileFactory('TS', gulp),
    doc: tasks.doc.doc,

    test: tasks.test.test,
    debug: tasks.test.debug,
    report: tasks.test.report,

    clean: tasks.clean.clean,
    purge: tasks.clean.purge,

    coverage: tasks.coverage.coverageFactory('TS', gulp),
    coverageShow: tasks.coverage.coverageShow,

    stickToMajorSemver: tasks.stickToMajorSemver
};
