module.exports = {
	all: true,
	include: ['lib/**/*.ts'],
	reporter: ['html', 'text', 'text-summary'],
	'check-coverage': true,
	lines: 80,
	functions: 80,
	branches: 80,
	clean: true
};
