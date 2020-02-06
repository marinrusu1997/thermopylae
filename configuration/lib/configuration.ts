import { fs } from '@marin/lib.utils';
import { ServiceRESTApiSchema } from '@marin/lib.rest-api';
import { readdir } from 'fs';
import { promisify } from 'util';
import { AppConfigLocations, ConfigurableModule } from './types';

const readDir = promisify(readdir);

class Configuration {
	private basePathForConfigLocations?: string;

	private modulesConfigLocations = new Map<ConfigurableModule, string>();

	public async init(pathToAppConfigLocations?: string): Promise<void> {
		pathToAppConfigLocations =
			pathToAppConfigLocations || `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/${process.env.APP_NAME}/app-config.json`;
		const appConfigLocations = (await fs.readJsonFromFile(pathToAppConfigLocations)) as AppConfigLocations;

		this.basePathForConfigLocations = appConfigLocations.basePath;

		this.modulesConfigLocations.set(ConfigurableModule.LIB_AUTH_ENGINE, appConfigLocations.libs.authEngine);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_FIREWALL, appConfigLocations.libs.firewall);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_GEO_IP, appConfigLocations.libs.geo_ip);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_LOGGER, appConfigLocations.libs.logger);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_JWT, appConfigLocations.libs.jwt);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_REST_API, appConfigLocations.libs.restApi);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_EMAIL, appConfigLocations.libs.email);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_SMS, appConfigLocations.libs.sms);

		this.modulesConfigLocations.set(ConfigurableModule.MYSQL, appConfigLocations.dataRepositories.mysql);
		this.modulesConfigLocations.set(ConfigurableModule.REDIS, appConfigLocations.dataRepositories.redis);
	}

	public for(module: ConfigurableModule): Promise<any> {
		if (module === ConfigurableModule.LIB_REST_API) {
			return Configuration.readServicesRestApiSchemas(this.modulesConfigLocations.get(module)!);
		}

		return fs.readJsonFromFile(`${this.basePathForConfigLocations}/${this.modulesConfigLocations.get(module)}`);
	}

	private static async readServicesRestApiSchemas(pathToSchemas: string): Promise<Array<ServiceRESTApiSchema>> {
		const serviceSchemasFiles = await readDir(pathToSchemas);
		const restApiSchemasPromises = [];
		for (let i = 0; i < serviceSchemasFiles.length; i++) {
			restApiSchemasPromises.push(fs.readJsonFromFile(`${pathToSchemas}/${serviceSchemasFiles[i]}`));
		}
		return ((await Promise.all(restApiSchemasPromises)) as unknown) as Promise<Array<ServiceRESTApiSchema>>;
	}
}

export { Configuration };
