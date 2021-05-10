/* eslint camelcase: 0 */ // --> OFF

import { addNodeRedisCommand } from 'handy-redis';
// eslint-disable-next-line import/extensions
import type { Result, ClientContext } from 'handy-redis/dist/generated/interface';

function addJsonModuleCommands(): void {
	addNodeRedisCommand('json.del');
	addNodeRedisCommand('json.get');
	addNodeRedisCommand('json.mget');
	addNodeRedisCommand('json.set');
	addNodeRedisCommand('json.type');
	addNodeRedisCommand('json.numincrby');
	addNodeRedisCommand('json.nummultby');
	addNodeRedisCommand('json.strappend');
	addNodeRedisCommand('json.strlen');
	addNodeRedisCommand('json.arrappend');
	addNodeRedisCommand('json.arrindex');
	addNodeRedisCommand('json.arrinsert');
	addNodeRedisCommand('json.arrlen');
	addNodeRedisCommand('json.arrpop');
	addNodeRedisCommand('json.arrtrim');
	addNodeRedisCommand('json.objkeys');
	addNodeRedisCommand('json.objlen');
	addNodeRedisCommand('json.debug');
	addNodeRedisCommand('json.resp');
}

interface JsonModuleCommands<
	Context extends ClientContext = {
		type: 'default';
	}
> {
	/**
	 * Delete a value. <br/>
	 * Non-existing keys and paths are ignored. Deleting an object's root is equivalent to deleting the key from Redis.
	 *
	 * @param key		Key under which JSON value is stored.
	 * @param path		Path in the JSON object. <br/>
	 * 					**Defaults** to root if not provided.
	 *
	 * 	@returns		 The number of paths deleted (0 or 1).
	 */
	json_del(key: string, path?: string): Result<0 | 1, Context>;

	/**
	 * ***Syntax***
	 * -------------------
	 * <pre>
	 * JSON.GET <key>
	 *			[INDENT indentation-string]
	 *			[NEWLINE line-break-string]
	 *			[SPACE space-string]
	 *			[NOESCAPE]
	 *			[path ...]
	 * </pre>
	 *
	 * ***Description***
	 * -------------------
	 * Return the value at *path* in JSON serialized form.
	 *
	 * This command accepts multiple *path* s, and defaults to the value's root when none are given.
	 *
	 * The following subcommands change the reply's format and are all set to the empty string by
	 * default:
	 * 	- *INDENT* sets the indentation string for nested levels
	 *  - *NEWLINE* sets the string that's printed at the end of each line
	 *  - *SPACE* sets the string that's put between a key and a value
	 *
	 * The *NOESCAPE* option will disable the sending of \uXXXX escapes for non-ascii characters.
	 * This option should be used for efficiency if you deal mainly with such text.
	 * The escaping of JSON strings will be deprecated in the future and this option will become the implicit default.
	 *
	 * @param key 	Key under which JSON value is stored.
	 * @param args 	Command arguments.
	 *
	 * @returns 	The reply's structure depends on the number of paths. <br/>
	 * 				A single path results in the value itself being returned,
	 * 				whereas multiple paths are returned as a JSON object in which each path is a key.
	 */
	json_get(key: string, ...args: ('INDENT' | 'NEWLINE' | 'SPACE' | 'NOESCAPE' | string)[]): Result<unknown | null, Context>;

	/**
	 * ***Syntax***
	 * -------------------
	 * <pre>
	 * JSON.MGET <key> [key ...] <path>
	 * </pre>
	 *
	 * ***Description***
	 * -------------------
	 * Returns the values at path from multiple key s.
	 * Non-existing keys and non-existing paths are reported as null.
	 *
	 * @param key 	Key under which JSON value is stored.
	 * @param args 	Command arguments.
	 *
	 * @returns		The JSON serialization of the value at each key's path.
	 */
	json_mget(key: string, ...args: string[]): Result<Array<unknown | null>, Context>;

	/**
	 * ***Syntax***
	 * -------------------
	 * <pre>
	 * JSON.SET <key> <path> <json> [NX | XX]
	 * </pre>
	 *
	 * ***Description***
	 * -------------------
	 * Can be found [here](https://oss.redislabs.com/redisjson/commands/#description_3).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 * @param json		Serialized JSON string.
	 * @param args		Command arguments.
	 *
	 * @returns			'OK' if executed correctly, or *null* if the specified *NX* or *XX* conditions were not met.
	 */
	json_set(key: string, path: string, json: string | Buffer, ...args: ('NX' | 'XX')[]): Result<'OK' | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsontype).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 *
	 * @returns			The type of value at `path`.
	 */
	json_type(key: string, path?: string): Result<string | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonnumincrby).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 * @param number	Increment number.
	 *
	 * @returns			The stringified new value.
	 */
	json_numincrby(key: string, path: string, number: number): Result<string, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonnummultby).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 * @param number	Multiply number.
	 *
	 * @returns			The stringified new value.
	 */
	json_nummultby(key: string, path: string, number: number): Result<string, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonstrappend).
	 *
	 * @param key			Key.
	 * @param path			JSON path.
	 * @param jsonString	JSON string.
	 *
	 * @returns				The string's new length.
	 */
	json_strappend(key: string, path: string | '.', jsonString: string): Result<number, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonstrlen).
	 *
	 * @param key			Key.
	 * @param path			JSON path.
	 *
	 * @returns				The string's length.
	 */
	json_strlen(key: string, path?: string): Result<number | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonarrappend).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 * @param json		JSON value.
	 * @param jsons		Other JSON values.
	 *
	 * @returns			The array's new size.
	 */
	json_arrappend(key: string, path: string, json: unknown, ...jsons: unknown[]): Result<number, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonarrindex).
	 *
	 * @param key			Key.
	 * @param path			JSON path.
	 * @param jsonScalar	JSON scalar.
	 * @param start			Start index.
	 * @param stop			Stop index.
	 *
	 * @returns				The position of the scalar value in the array, or -1 if unfound.
	 */
	json_arrindex(key: string, path: string, jsonScalar: boolean | number | string, start?: number, stop?: number): Result<number | -1, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonarrinsert).
	 *
	 * @param key			Key.
	 * @param path			JSON path.
	 * @param index			Array index.
	 * @param json			JSON value.
	 * @param jsons			Other JSON values.
	 *
	 * @returns				The array's new length.
	 */
	json_arrinsert(key: string, path: string, index: number, json: unknown, ...jsons: unknown[]): Result<number, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonarrlen).
	 *
	 * @param key	Key.
	 * @param path	JSON path.
	 *
	 * @returns		The array length.
	 */
	json_arrlen(key: string, path?: string): Result<number | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonarrpop).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 * @param index		Array index.
	 *
	 * @returns			The popped JSON value.
	 */
	json_arrpop(key: string, path?: string, index?: number): Result<string | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonarrtrim).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 * @param start		Start index.
	 * @param stop		Stop index.
	 *
	 * @returns			The array new length.
	 */
	json_arrtrim(key: string, path: string, start: number, stop: number): Result<number, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonobjkeys).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 *
	 * @returns		Object keys.
	 */
	json_objkeys(key: string, path?: string): Result<string[] | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonobjlen).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 *
	 * @returns			The number of keys in the object.
	 */
	json_objlen(key: string, path?: string): Result<number | null, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsondebug).
	 *
	 * @param subcommand	Subcommand.
	 * @param key			Key.
	 * @param path			JSON path.
	 *
	 * @returns				The size in bytes of the value
	 */
	json_debug(subcommand: 'MEMORY', key: string, path?: string): Result<number, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsondebug).
	 *
	 * @param subcommand	Subcommand.
	 *
	 * @returns				Array with the help message.
	 */
	json_debug(subcommand: 'HELP'): Result<Array<string>, Context>;

	/**
	 * [Documentation](https://oss.redislabs.com/redisjson/commands/#jsonresp).
	 *
	 * @param key		Key.
	 * @param path		JSON path.
	 *
	 * @returns			The JSON's RESP form.
	 */
	json_resp(key: string, path?: string): Result<Array<unknown>, Context>;
}

export { addJsonModuleCommands };
export type { JsonModuleCommands };
