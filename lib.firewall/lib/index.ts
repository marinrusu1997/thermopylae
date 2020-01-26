import { fs, object } from '@marin/lib.utils';
// eslint-disable-next-line import/no-unresolved
import { Services } from '@marin/lib.utils/dist/enums';
import { readdir } from 'fs';
import { promisify } from 'util';
import Ajv, { ErrorObject } from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import { FilterXSS } from 'xss';

const readDir = promisify(readdir);

const SCHEMAS_DIR = `${__dirname}/schemas`;
const EXCLUDE_SCHEMAS_DIR = ['core'];

class Firewall {
	private static readonly validator: Ajv.Ajv = new Ajv({
		loadSchema: uri => fs.readJsonFromFile(`${SCHEMAS_DIR}/${uri}`)
	});

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
		return Firewall.validator.validate(schemaId, data) as Promise<object>;
	}

	public static sanitize(data: object | string, exceptPaths?: Set<string>): object | string {
		// SQLi are not sanitized, Prepared Statements will be used

		if (typeof data === 'string') {
			return Firewall.xssFilter.process(data);
		}
		return object.traverse(data, (currentPath, value) => {
			if (typeof value === 'string') {
				if (exceptPaths && exceptPaths.has(currentPath)) {
					return value;
				}
				return Firewall.xssFilter.process(value);
			}
			return value;
		});
	}

	public static joinErrors(errors: Array<ErrorObject>, into: 'text' | 'object', skippedKeywords = ['pattern']): string | object {
		switch (into) {
			case 'text':
				AjvLocalizeEn(errors);
				return Firewall.validator.errorsText(errors, { separator: '\n' });
			case 'object':
				const errObj: any = {};
				let error;
				for (let i = 0; i < errors.length; i++) {
					error = errors[i];
					if (skippedKeywords.includes(error.keyword)) {
						continue;
					}
					errObj[error.dataPath] = error.message;
				}
				return errObj;
			default:
				throw new Error('Invalid into param');
		}
	}

	private static computeSchemaId(service: Services, method: string): string {
		return `#${service}-${method}`;
	}
}

export { Firewall };
