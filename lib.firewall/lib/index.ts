import { services, fs } from '@marin/lib.utils';
import { readdir } from 'fs';
import { promisify } from 'util';
import Ajv from 'ajv';

const readDir = promisify(readdir);

const SCHEMAS_DIR = `${__dirname}/schemas`;
const EXCLUDE_SCHEMAS_DIR = ['base'];

class Firewall {
	private static readonly validator: Ajv.Ajv = new Ajv({ loadSchema: uri => fs.readJsonFromFile(`${SCHEMAS_DIR}/${uri}`) });

	static init(): Promise<void> {
		return readDir(SCHEMAS_DIR)
			.then(schemasDirs => {
				return schemasDirs.filter(schemaDir => !EXCLUDE_SCHEMAS_DIR.includes(schemaDir));
			})
			.then(servicesSchemasDirs => {
				const servicesSchemasPromises = [];
				for (let i = 0; i < servicesSchemasDirs.length; i++) {
					servicesSchemasPromises.push(
						readDir(`${SCHEMAS_DIR}/${servicesSchemasDirs[i]}`).then(schemas => {
							const schemasPromises = [];
							for (let j = 0; j < schemas.length; j++) {
								schemasPromises.push(
									fs.readJsonFromFile(`${SCHEMAS_DIR}/${servicesSchemasDirs[i]}/${schemas[j]}`).then(schema => {
										// @ts-ignore
										schema.$async = true;
										Firewall.validator.addSchema(schema);
										return Firewall.validator.compileAsync(schema);
									})
								);
							}
							return Promise.all(schemasPromises);
						})
					);
				}
				return (Promise.all(servicesSchemasPromises) as unknown) as Promise<void>;
			});
	}

	static validate(service: services.SERVICES, method: string, data: object): Promise<object> {
		const schemaId = Firewall.computeSchemaId(service, method);
		return Firewall.validator.validate(schemaId, data) as Promise<object>;
	}

	static sanitize(data: object): void {
		console.warn(data);
	}

	private static computeSchemaId(service: services.SERVICES, method: string): string {
		return `#${service}-${method}`;
	}
}

export { Firewall };
