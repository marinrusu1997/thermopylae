import { fs, object as objectUtils } from '@marin/lib.utils';
import { Services } from '@marin/lib.utils/dist/enums';
import { readdir } from 'fs';
import { promisify } from 'util';
import Ajv, { ErrorObject } from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import { FilterXSS } from 'xss';

const readDir = promisify(readdir);

class Firewall {
	private static validator: Ajv.Ajv;

	private static readonly xssFilter: FilterXSS = new FilterXSS();

	public static async init(jsonSchemaDir?: string, excludeDirs?: Array<string>): Promise<void> {
		jsonSchemaDir = jsonSchemaDir || `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/${process.env.APP_NAME}/validation`;

		Firewall.validator = new Ajv({
			loadSchema: uri => fs.readJsonFromFile(`${jsonSchemaDir}/${uri}`)
		});

		let servicesSchemasDirs = await readDir(jsonSchemaDir);
		if (excludeDirs && excludeDirs.length !== 0) {
			servicesSchemasDirs = servicesSchemasDirs.filter(schemaDir => !excludeDirs.includes(schemaDir));
		}

		const servicesSchemasPromises = [];
		for (let i = 0; i < servicesSchemasDirs.length; i++) {
			servicesSchemasPromises.push(
				readDir(`${jsonSchemaDir}/${servicesSchemasDirs[i]}`).then(schemas => {
					const schemasPromises = [];
					for (let j = 0; j < schemas.length; j++) {
						schemasPromises.push(
							fs.readJsonFromFile(`${jsonSchemaDir}/${servicesSchemasDirs[i]}/${schemas[j]}`).then(schema => {
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

		return ((await Promise.all(servicesSchemasPromises)) as unknown) as Promise<void>;
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

		return objectUtils.traverse(data, (currentPath, value) => {
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
