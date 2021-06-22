import { fs, object } from '@thermopylae/lib.utils';
import { ObjMap } from '@thermopylae/core.declarations';
import { readdir } from 'fs';
import { promisify } from 'util';
import Ajv, { ErrorObject } from 'ajv';
// eslint-disable-next-line import/extensions
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import { FilterXSS } from 'xss';

const readDir = promisify(readdir);

class ApiValidator {
	private static readonly JOIN_ERRORS_TEXT_OPTIONS = { separator: '\n' };

	private static readonly JOIN_ERRORS_SKIPPED_KEYWORDS = ['pattern'];

	private validator: Ajv | null;

	private readonly xssFilter: FilterXSS;

	public constructor() {
		this.validator = null;
		this.xssFilter = new FilterXSS();
	}

	public async init(validationSchemasDir?: string, excludeDirs?: Array<string>): Promise<void> {
		if (validationSchemasDir == null) {
			validationSchemasDir = `${process.env['XDG_CONFIG_HOME'] || `${process.env['HOME']}/.config`}/${process.env['APP_NAME']}/validation`;
		}

		this.validator = new Ajv({
			loadSchema: (uri) => fs.readJsonFromFile(`${validationSchemasDir}/${uri}`)
		});

		let servicesSchemasDirs = await readDir(validationSchemasDir);
		if (excludeDirs && excludeDirs.length !== 0) {
			servicesSchemasDirs = servicesSchemasDirs.filter((schemaDir) => !excludeDirs.includes(schemaDir));
		}

		const servicesSchemasPromises = [];
		for (let i = 0; i < servicesSchemasDirs.length; i++) {
			servicesSchemasPromises.push(
				readDir(`${validationSchemasDir}/${servicesSchemasDirs[i]}`).then((schemas) => {
					const schemasPromises = [];
					for (let j = 0; j < schemas.length; j++) {
						schemasPromises.push(
							fs.readJsonFromFile(`${validationSchemasDir}/${servicesSchemasDirs[i]}/${schemas[j]}`).then((schema) => {
								// @ts-ignore
								schema.$async = true;
								this.validator!.addSchema(schema);
								return this.validator!.compileAsync(schema);
							})
						);
					}
					return Promise.all(schemasPromises);
				})
			);
		}

		return (await Promise.all(servicesSchemasPromises)) as unknown as Promise<void>;
	}

	public async validate(service: string, method: string, data: ObjMap): Promise<ObjMap> {
		return this.validator!.validate(ApiValidator.computeSchemaId(service, method), data) as unknown as Promise<ObjMap>;
	}

	public sanitize(data: ObjMap | string, exceptPaths?: Set<string>): ObjMap | string {
		// SQLi are not sanitized, Prepared Statements will be used

		if (typeof data === 'string') {
			return this.xssFilter.process(data);
		}

		return object.traverse(data, (currentPath, value) => {
			if (typeof value === 'string') {
				if (exceptPaths && exceptPaths.has(currentPath)) {
					return value;
				}
				return this.xssFilter.process(value);
			}
			return value;
		});
	}

	public joinErrors(errors: Array<ErrorObject | Partial<ErrorObject>>, into: 'text' | 'object', skippedKeywords?: string[]): string | ObjMap {
		switch (into) {
			case 'text':
				AjvLocalizeEn(errors as any);
				return this.validator!.errorsText(errors as Array<ErrorObject>, ApiValidator.JOIN_ERRORS_TEXT_OPTIONS);

			case 'object': {
				if (skippedKeywords == null) {
					skippedKeywords = ApiValidator.JOIN_ERRORS_SKIPPED_KEYWORDS;
				}

				const errObj: ObjMap = {};

				for (let i = 0; i < errors.length; i++) {
					if (skippedKeywords.includes((errors[i] as ErrorObject).keyword)) {
						continue;
					}
					errObj[(errors[i] as ErrorObject).instancePath] = errors[i].message;
				}

				return errObj;
			}

			default:
				throw new Error("Invalid 'into' param");
		}
	}

	private static computeSchemaId(service: string, method: string): string {
		return `#${service}-${method}`;
	}
}

export { ApiValidator };
