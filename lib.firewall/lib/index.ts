import { fs, object } from '@marin/lib.utils';
// eslint-disable-next-line import/no-unresolved
import { Services } from '@marin/lib.utils/dist/enums';
import { readdir } from 'fs';
import { promisify } from 'util';
import Ajv from 'ajv';
import { FilterXSS } from 'xss';

const readDir = promisify(readdir);

const SCHEMAS_DIR = `${__dirname}/schemas`;
const EXCLUDE_SCHEMAS_DIR = ['core'];

class Firewall {
	private static readonly validator: Ajv.Ajv = new Ajv({ loadSchema: uri => fs.readJsonFromFile(`${SCHEMAS_DIR}/${uri}`) });

	private static readonly xssFilter: FilterXSS = new FilterXSS();

	public static init(): Promise<void> {
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

	public static validate(service: Services, method: string, data: object): Promise<object> {
		const schemaId = Firewall.computeSchemaId(service, method);
		return (Firewall.validator.validate(schemaId, data) as Promise<object>).catch(e => {
			e.message = 'Validation failed. Details:';
			let separator = ' ';
			for (let i = 0; i < e.errors.length; i++) {
				delete e.errors[i].schemaPath;
				delete e.errors[i].params;
				e.message += `${separator}${JSON.stringify(e.errors[i])}`;
				separator = ', ';
			}
			throw e;
		});
	}

	public static sanitize(data: object | string): object | string {
		// SQLi are not sanitized, Prepared Statements will be used

		if (typeof data === 'string') {
			return Firewall.xssFilter.process(data);
		}
		return object.traverse(data, value => (typeof value === 'string' ? Firewall.xssFilter.process(value) : undefined));
	}

	private static computeSchemaId(service: Services, method: string): string {
		return `#${service}-${method}`;
	}
}

export { Firewall };
