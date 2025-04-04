const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
	{
		Client: 'client',
		ConnectionsManager: 'connections_interface',
		PoolClusterConnectionsManager: 'connections_cluster',
		Logging: 'logger',
		Error: 'error',
		Utils: 'utils'
	}
];

typedoc.links = [
	{
		label: 'Thermopylae',
		url: 'https://marinrusu1997.github.io/thermopylae'
	},
	{
		label: 'Github',
		url: 'https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.mysql'
	}
];

module.exports = typedoc;
