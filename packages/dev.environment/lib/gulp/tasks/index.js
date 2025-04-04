'use strict';

const build = require('./build');
const doc = require('./doc');
const readme = require('./readme');
const clean = require('./clean');
const test = require('./test');
const coverage = require('./coverage');
const stickToMajorSemver = require('./stickToMajorSemver');

module.exports = {
	build,
	doc,
	readme,
	clean,
	test,
	coverage,
	stickToMajorSemver
};
