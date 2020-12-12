import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { ServiceRESTApiSchema } from '@marin/lib.rest-api';
import { ConfigurableModule, Configuration } from '../lib';

describe('configuration spec', () => {
	const geoipConfig = {
		ipStackAPIKey: 'some-key'
	};

	async function testConfigLoadedFor(config: Configuration, module: ConfigurableModule, expectedConfig: any): Promise<void> {
		const firewallConfig = await config.for(module);
		expect(firewallConfig).to.be.deep.eq(expectedConfig);
	}

	beforeEach(() => {
		process.env = {
			APP_NAME: 'app'
		};
	});

	it('loads app configuration from specified path (basePath not specified)', async () => {
		const config = new Configuration('test/fixtures/.config/app/app-config.json');
		await config.init();
		await testConfigLoadedFor(config, ConfigurableModule.LIB_GEO_IP, geoipConfig);
	});

	it('loads app configuration fro specified path (basePath is specified)', async () => {
		const config = new Configuration('test/fixtures/.config/app/app-config-base-path.json');
		await config.init();
		await testConfigLoadedFor(config, ConfigurableModule.LIB_GEO_IP, geoipConfig);
	});

	it('loads app configuration from XDG_CONFIG_HOME when path not specified (basePath not specified)', async () => {
		process.env.XDG_CONFIG_HOME = 'test/fixtures/.config';
		const config = new Configuration();
		await config.init();
		await testConfigLoadedFor(config, ConfigurableModule.LIB_GEO_IP, geoipConfig);
	});

	it('loads app configuration from HOME/.config when no XDG_CONFIG_HOME and explicit path not specified (basePath not specified)', async () => {
		process.env.HOME = 'test/fixtures';
		const config = new Configuration();
		await config.init();
		await testConfigLoadedFor(config, ConfigurableModule.LIB_GEO_IP, geoipConfig);
	});

	it('handles rest api config special case (basePath not specified)', async () => {
		const config = new Configuration('test/fixtures/.config/app/app-config.json');
		await config.init();
		const serviceSchemas = (await config.for(ConfigurableModule.LIB_REST_API)) as Array<ServiceRESTApiSchema>;
		expect(serviceSchemas.length).to.be.eq(1);
		expect(serviceSchemas[0]).to.be.deep.eq({ name: 'service' });
	});
});
