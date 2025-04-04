const path = require('path');
const fs = require('fs');
const gulp = require('gulp');
const replace = require('gulp-replace');
const { notNull } = require('../../utils');
const { PLACEHOLDERS, PLACEHOLDER_VALUES } = require('../../constants');

function setMissingPlaceholderValues() {
	const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
	PLACEHOLDER_VALUES.set(PLACEHOLDERS.MODULE_NAME, pkgJson.name);
	PLACEHOLDER_VALUES.set(PLACEHOLDERS.MODULE_VERSION, encodeURIComponent(pkgJson.version));
	PLACEHOLDER_VALUES.set(PLACEHOLDERS.MODULE_DESCRIPTION, pkgJson.description);
	PLACEHOLDER_VALUES.set(PLACEHOLDERS.MODULE_NODE_VERSION, encodeURIComponent(pkgJson.engines.node));
}

function readme() {
	setMissingPlaceholderValues();

	const pathToTemplate = path.join(__dirname, '../../templates/README.md');
	let pipeline = gulp.src([pathToTemplate]);

	for (const [placeholder, value] of PLACEHOLDER_VALUES) {
		pipeline = pipeline.pipe(replace(placeholder, notNull(value)));
	}

	return pipeline.pipe(gulp.dest('./'));
}

module.exports = readme;
