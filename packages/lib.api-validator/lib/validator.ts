import { fs, object } from '@thermopylae/lib.utils';
import { ObjMap } from '@thermopylae/core.declarations';
import { readdir } from 'fs';
import { promisify } from 'util';
import Ajv, { ErrorObject } from 'ajv';
// eslint-disable-next-line import/extensions
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import addFormats from 'ajv-formats';
import { FilterXSS } from 'xss';

/**
 * @private
 */
const readDir = promisify(readdir);

/**
 * Class which allows to validate data that is coming to API endpoints. <br/>
 * Internally it uses [ajv](https://www.npmjs.com/package/ajv) in order to validate JSON objects. <br/>
 * XSS sanitization is performed with the [xss](https://www.npmjs.com/package/xss) npm package.
 */
class ApiValidator {
	private static readonly JOIN_ERRORS_TEXT_OPTIONS = { separator: '\n' };

	private static readonly JOIN_ERRORS_SKIPPED_KEYWORDS = ['pattern'];

	private validator: Ajv | null;

	private readonly xssFilter: FilterXSS;

	/**
	 * Create {@link ApiValidator} instance.
	 */
	public constructor() {
		this.validator = null;
		this.xssFilter = new FilterXSS();
	}

	/**
	 * Initializes {@link ApiValidator} and reads validation JSON Schemas.
	 * Each JSON schema needs to have an id of this format: `#${service}-${method}`. <br/>
	 * JSON schemas needs to be located on the file system in the following topology: <br/>
	 *
	 * └─ <${validationSchemasDir}> <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;└─ service-1 <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;│  &nbsp;├─ schema-1.json <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;│  &nbsp;└─ schema-2.json <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;├─ service-2 <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;│  &nbsp;├─ schema-1.json <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;│  &nbsp;├─ schema-2.json <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;│  &nbsp;└─ schema-n.json <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;└─ service-n <br/>
	 * &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ schema-1.json
	 *
	 * @param validationSchemasDir		Directory where validation schemas are located. <br/>
	 * 									Defaults to **`${process.env['XDG_CONFIG_HOME'] || `${process.env['HOME']}/.config`}/${process.env['APP_NAME']}/validation`**.
	 * @param excludeDirs				Directories from the `validationSchemasDir` which needs to be excluded, i.e. their schemas should not be loaded.
	 */
	public async init(validationSchemasDir?: string, excludeDirs?: Array<string>): Promise<void> {
		if (validationSchemasDir == null) {
			validationSchemasDir = `${process.env['XDG_CONFIG_HOME'] || `${process.env['HOME']}/.config`}/${process.env['APP_NAME']}/validation`;
		}

		this.validator = new Ajv({
			loadSchema: (uri) => fs.readJsonFromFile(`${validationSchemasDir}/${uri}`)
		});
		addFormats(this.validator as any);

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

	/**
	 * Validate data against JSON schema.
	 * Id of the schema is formed from `#${service}-${method}`.
	 *
	 * @param service		Name of the service.
	 * @param method		Name of the method.
	 * @param data			Data to be validated.
	 *
	 * @throws {ErrorObject} When data doesn't match schema.
	 *
	 * @returns				Validated data.
	 */
	public async validate(service: string, method: string, data: ObjMap): Promise<ObjMap> {
		return this.validator!.validate(ApiValidator.computeSchemaId(service, method), data) as unknown as Promise<ObjMap>;
	}

	/**
	 * Sanitizes data against XSS vulnerability. <br/>
	 * Notice that in case of JSON data, only values will be sanitized, while keys will be left untouched.
	 *
	 * @param data				Data to be sanitized.
	 * @param exceptPaths		When data is an object, you can specify a set of [dot paths](https://www.npmjs.com/package/dot-prop), values of which should not be sanitized.
	 *
	 * @returns					Sanitized data.
	 */
	public sanitize(data: ObjMap | string, exceptPaths?: Set<string>): ObjMap | string {
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

	/**
	 * Joins errors from the exception thrown by {@link ApiValidator.validate} method. <br/>
	 * Errors can be joined into text or object. <br/>
	 * When *text* is specified, errors will be joined into message using [ajv-i18n](https://github.com/ajv-validator/ajv-i18n). <br/>
	 * When *json* is specified, errors will be joined into an object,
	 * having as key [instancePath](https://ajv.js.org/api.html#error-objects) error property and as value [message](https://ajv.js.org/api.html#error-objects) error property.
	 *
	 * @param errors				[Error objects](https://ajv.js.org/api.html#error-objects) from the exception thrown by {@link ApiValidator.validate} method.
	 * @param into					Format into which errors need to be joined.
	 * @param skippedKeywords		When format is *json*, you can skip some error objects having [keyword](https://ajv.js.org/api.html#error-objects) property present in this list.
	 *
	 * @returns						Joined errors.
	 */
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
