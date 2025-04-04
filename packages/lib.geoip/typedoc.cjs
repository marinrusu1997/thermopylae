const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.exclude.push('lib/load-balancer.ts');

typedoc.outline = [
	{
		Locator: 'geoip',
		Error: 'error',
		Repositories: {
			Interface: 'repository',
			GeoIpLiteRepository: 'repository_geoip_lite',
			IpLocateRepository: 'repository_iplocate',
			IpstackRepository: 'repository_ipstack'
		}
	}
];

typedoc.links = [
	{
		label: 'Thermopylae',
		url: 'https://marinrusu1997.github.io/thermopylae'
	},
	{
		label: 'Github',
		url: 'https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.geoip'
	}
];

module.exports = typedoc;
