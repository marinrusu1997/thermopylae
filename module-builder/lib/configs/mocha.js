module.exports = {
	"exit": true,
	"color": true,
	"recursive": true,
	"watch": false,
	"watch-extensions": [
		"ts"
	],
	"require": [
		"esm",
		"ts-node/register"
	],
	"spec": [
		"test/**/*.spec.ts"
	]
};
