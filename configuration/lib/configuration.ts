import { fs } from '@marin/lib.utils';
import { ServiceRESTApiSchema } from '@marin/lib.rest-api';
import { readdir } from 'fs';
import { promisify } from 'util';
import { dirname } from 'path';
import { AppConfigLocations, ConfigurableModule } from './typings';

const readDir = promisify(readdir);

class Configuration {
	private readonly pathToAppConfigLocations: string;

	private basePathForConfigLocations: string | undefined;

	private readonly modulesConfigLocations = new Map<ConfigurableModule, string>();

	constructor(pathToAppConfigLocations?: string) {
		this.pathToAppConfigLocations =
			pathToAppConfigLocations || `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/${process.env.APP_NAME}/app-config.json`;
	}

	public async init(): Promise<void> {
		const appConfigLocations = (await fs.readJsonFromFile(this.pathToAppConfigLocations)) as AppConfigLocations;

		this.basePathForConfigLocations = appConfigLocations.basePath || dirname(this.pathToAppConfigLocations);

		this.modulesConfigLocations.set(ConfigurableModule.LIB_AUTH_ENGINE, `${this.basePathForConfigLocations}/${appConfigLocations.libs.authEngine}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_FIREWALL, `${this.basePathForConfigLocations}/${appConfigLocations.libs.firewall}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_GEO_IP, `${this.basePathForConfigLocations}/${appConfigLocations.libs.geoIp}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_LOGGER, `${this.basePathForConfigLocations}/${appConfigLocations.libs.logger}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_JWT, `${this.basePathForConfigLocations}/${appConfigLocations.libs.jwt}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_REST_API, `${this.basePathForConfigLocations}/${appConfigLocations.libs.restApi}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_EMAIL, `${this.basePathForConfigLocations}/${appConfigLocations.libs.email}`);
		this.modulesConfigLocations.set(ConfigurableModule.LIB_SMS, `${this.basePathForConfigLocations}/${appConfigLocations.libs.sms}`);

		this.modulesConfigLocations.set(ConfigurableModule.MYSQL, `${this.basePathForConfigLocations}/${appConfigLocations.dataRepositories.mysql}`);
		this.modulesConfigLocations.set(ConfigurableModule.REDIS, `${this.basePathForConfigLocations}/${appConfigLocations.dataRepositories.redis}`);
	}

	public for(module: ConfigurableModule): Promise<any> {
		if (module === ConfigurableModule.LIB_REST_API) {
			return Configuration.readServicesRestApiSchemas(this.modulesConfigLocations.get(module)!);
		}

		return fs.readJsonFromFile(this.modulesConfigLocations.get(module)!);
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
