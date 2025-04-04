const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
	{
		Middleware: 'middleware',
		InvalidAccessTokensMemCache: 'storages_access_tokens',
		Logging: 'logger',
		Error: 'error'
	}
];

typedoc.links = [
	{
		label: 'Thermopylae',
		url: 'https://marinrusu1997.github.io/thermopylae'
	},
	{
		label: 'Github',
		url: 'https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.jwt-session'
	}
];

module.exports = typedoc;
