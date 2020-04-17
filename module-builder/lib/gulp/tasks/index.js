"use strict";

const build = require('./build');
const clean = require('./clean');
const test = require('./test');
const coverage = require('./coverage');
const stickToMajorSemver = require('./stickToMajorSemver');

module.exports = {
    build,
    clean,
    test,
    coverage,
    stickToMajorSemver: stickToMajorSemver.stickToMajorSemver
};
