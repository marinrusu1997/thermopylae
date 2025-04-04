import type { ObjMap } from '@thermopylae/core.declarations';
import { fs, object, type types } from '@thermopylae/lib.utils';
import { Ajv, type Ajv as AjvType, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import AjvLocalizeEn from 'ajv-i18n/localize/en/index.js';
import { readdir } from 'node:fs';
import { promisify } from 'node:util';
import { FilterXSS } from 'xss';

/** @private */
const readDir = promisify(readdir);

/**
 * Class which allows to validate data that is coming to API endpoints. <br/> Internally it uses
 * [ajv](https://www.npmjs.com/package/ajv) in order to validate JSON objects. <br/> XSS
 * sanitization is performed with the [xss](https://www.npmjs.com/package/xss) npm package.
 */
class ApiValidator {
	private static readonly JOIN_ERRORS_TEXT_OPTIONS = { separator: '\n' };

	private static readonly JOIN_ERRORS_SKIPPED_KEYWORDS = ['pattern'];

	private validator: AjvType | null;

	private readonly xssFilter: FilterXSS;

	/** Create {@link ApiValidator} instance. */
	public constructor() {
		this.validator = null;
		this.xssFilter = new FilterXSS();
	}

	/**
	 * Initializes {@link ApiValidator} and reads validation JSON Schemas. Each JSON schema needs to
	 * have an id of this format: `#${service}-${method}`. <br/> JSON schemas needs to be located on
	 * the file system in the following topology: <br/>
	 *
	 * └─ <${validationSchemasDir}> <br/> └─ service-1 <br/> │ ├─ schema-1.json <br/> │ └─
	 * schema-2.json <br/> ├─ service-2 <br/> │ ├─ schema-1.json <br/> │ ├─ schema-2.json <br/> │ └─
	 * schema-n.json <br/> └─ service-n <br/> └─ schema-1.json.
	 *
	 * @param validationSchemasDir Directory where validation schemas are located. <br/> Defaults to
	 *   **`${process.env['XDG_CONFIG_HOME'] ||
	 *   `${process.env['HOME']}/.config`}/${process.env['APP_NAME']}/validation`**.
	 * @param excludeDirs          Directories from the `validationSchemasDir` which needs to be
	 *   excluded, i.e. their schemas should not be loaded.
	 */
	public async init(validationSchemasDir?: string, excludeDirs?: string[]): Promise<void> {
		if (validationSchemasDir == null) {
			validationSchemasDir = `${process.env['XDG_CONFIG_HOME'] || `${process.env['HOME']}/.config`}/${process.env['APP_NAME']}/validation`;
		}

		this.validator = new Ajv({
			loadSchema: (uri) => fs.readJsonFromFile(`${validationSchemasDir}/${uri}`)
		});
		// @ts-expect-error -- It is callablellable
		addFormats(this.validator as types.Any);

		let servicesSchemasDirs = await readDir(validationSchemasDir);
		if (excludeDirs && excludeDirs.length > 0) {
			servicesSchemasDirs = servicesSchemasDirs.filter((schemaDir) => !excludeDirs.includes(schemaDir));
		}

		const servicesSchemasPromises = [];
		for (const serviceSchemasDir of servicesSchemasDirs) {
			servicesSchemasPromises.push(
				readDir(`${validationSchemasDir}/${serviceSchemasDir}`).then((schemas) => {
					const schemasPromises = [];
					for (const schema of schemas) {
						schemasPromises.push(
							// oxlint-disable-next-line no-nesting
							fs.readJsonFromFile(`${validationSchemasDir}/${serviceSchemasDir}/${schema}`).then((schema) => {
								// @ts-expect-error The schema as incorrect typingsypings
								schema.$async = true;
								this.validator?.addSchema(schema);
								return this.validator?.compileAsync(schema);
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
	 * Validate data against JSON schema. Id of the schema is formed from `#${service}-${method}`.
	 *
	 * @param   service             Name of the service.
	 * @param   method              Name of the method.
	 * @param   data                Data to be validated.
	 *
	 * @returns         Validated data.
	 *
	 * @throws  {ErrorObject}         When data doesn't match schema.
	 */
	public validate(service: string, method: string, data: ObjMap): Promise<ObjMap> {
		return this.validator?.validate(ApiValidator.computeSchemaId(service, method), data) as unknown as Promise<ObjMap>;
	}

	/**
	 * Sanitizes data against XSS vulnerability. <br/> Notice that in case of JSON data, only values
	 * will be sanitized, while keys will be left untouched.
	 *
	 * @param   data        Data to be sanitized.
	 * @param   exceptPaths When data is an object, you can specify a set of [dot
	 *   paths](https://www.npmjs.com/package/dot-prop), values of which should not be sanitized.
	 *
	 * @returns             Sanitized data.
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
	 * Joins errors from the exception thrown by {@link ApiValidator.validate} method. <br/> Errors
	 * can be joined into text or object. <br/> When _text_ is specified, errors will be joined into
	 * message using [ajv-i18n](https://github.com/ajv-validator/ajv-i18n). <br/> When _json_ is
	 * specified, errors will be joined into an object, having as key
	 * [instancePath](https://ajv.js.org/api.html#error-objects) error property and as value
	 * [message](https://ajv.js.org/api.html#error-objects) error property.
	 *
	 * @param   errors          [Error objects](https://ajv.js.org/api.html#error-objects) from the
	 *   exception thrown by {@link ApiValidator.validate} method.
	 * @param   into            Format into which errors need to be joined.
	 * @param   skippedKeywords When format is _json_, you can skip some error objects having
	 *   [keyword](https://ajv.js.org/api.html#error-objects) property present in this list.
	 *
	 * @returns                 Joined errors.
	 */
	public joinErrors(errors: (ErrorObject | Partial<ErrorObject>)[], into: 'text' | 'object', skippedKeywords?: string[]): string | ObjMap {
		switch (into) {
			case 'text':
				// @ts-expect-error -- It is callablellable
				AjvLocalizeEn(errors as unknown);
				return this.validator?.errorsText(errors as ErrorObject[], ApiValidator.JOIN_ERRORS_TEXT_OPTIONS) ?? '';

			case 'object': {
				if (skippedKeywords == null) {
					skippedKeywords = ApiValidator.JOIN_ERRORS_SKIPPED_KEYWORDS;
				}

				const errObj: ObjMap = {};
				for (const error of errors) {
					if (skippedKeywords.includes((error as ErrorObject).keyword)) {
						continue;
					}
					errObj[(error as ErrorObject).instancePath] = error.message;
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
