"use strict";

const build = require('./build');
const doc = require('./doc');
const clean = require('./clean');
const test = require('./test');
const coverage = require('./coverage');
const stickToMajorSemver = require('./stickToMajorSemver');

module.exports = {
    build,
    doc,
    clean,
    test,
    coverage,
    stickToMajorSemver: stickToMajorSemver.stickToMajorSemver
};
