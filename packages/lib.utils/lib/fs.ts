import type { ObjMap } from '@thermopylae/core.declarations';
import { readFile, writeFile } from 'fs';
import { TypedJson } from './json.js';

/**
 * Writes a JSON to file.
 *
 * @param path Path of the file.
 * @param json Json object to be written.
 */
function writeJsonToFile(path: string, json: ObjMap): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		try {
			writeFile(path, JSON.stringify(json), { encoding: 'utf8' }, (err) => {
				return err ? reject(err) : resolve();
			});
		} catch (e) {
			reject(e); // stringify or writeFile might throw
		}
	});
}

/**
 * Reads json from file.
 *
 * @param   path Path to json file.
 *
 * @returns      Parsed Json.
 */
function readJsonFromFile(path: string): Promise<ObjMap> {
	return new Promise<ObjMap>((resolve, reject) => {
		readFile(path, 'utf8', (err, content) => {
			if (err) {
				return reject(err);
			}
			try {
				return resolve(TypedJson.parse<ObjMap>(content));
			} catch (e) {
				return reject(e); // parse might throw
			}
		});
	});
}

export { writeJsonToFile, readJsonFromFile };
