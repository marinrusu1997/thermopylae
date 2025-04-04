const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
	{
		Request: 'request',
		Response: 'response'
	}
];

typedoc.links = [
	{
		label: 'Thermopylae',
		url: 'https://marinrusu1997.github.io/thermopylae'
	},
	{
		label: 'Github',
		url: 'https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.adapter.fastify'
	}
];

module.exports = typedoc;
