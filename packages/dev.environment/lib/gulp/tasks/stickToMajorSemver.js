'use strict';

const fs = require('fs');
const { isObject } = require('../../utils');

function stickToMajorSemver(done) {
	fs.readFile('package.json', 'utf8', (err, content) => {
		if (err) {
			done(err);
		}

		const pkg = JSON.parse(content);

		function trimSemver(deps) {
			for (const dep in deps) {
				const res = /^\D?(\d+)/.exec(deps[dep]);
				if (res && res[1]) {
					deps[dep] = res[1];
				}
			}
		}

		if (isObject(pkg.dependencies)) {
			trimSemver(pkg.dependencies);
		}

		if (isObject(pkg.devDependencies)) {
			trimSemver(pkg.devDependencies);
		}

		fs.writeFile('package.json', JSON.stringify(pkg, null, 4), done);
	});
}

module.exports = stickToMajorSemver;
