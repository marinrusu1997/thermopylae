const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
	{
		Store: 'store',
		Error: 'error',
		Typings: 'typings'
	}
];

typedoc.links = [
	{
		label: 'Thermopylae',
		url: 'https://marinrusu1997.github.io/thermopylae'
	},
	{
		label: 'Github',
		url: 'https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.indexed-store'
	}
];

module.exports = typedoc;
