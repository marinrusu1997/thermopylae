'use strict';

async function clean() {
	await (
		await import('del')
	)(['dist', 'build', '.nyc_output', 'coverage', 'report', 'doc']);
}

async function purge() {
	await clean();
	(await import('del'))(['node_modules', 'package-lock.json']);
}

module.exports = {
	clean,
	purge
};
