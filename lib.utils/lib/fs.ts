import { readFile, writeFile } from 'fs';
import { ObjMap } from '@thermopylae/core.declarations';

/**
 * Writes a JSON to file.
 *
 * @param path	Path of the file.
 * @param json	Json object to be written.
 */
function writeJsonToFile(path: string, json: ObjMap): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		writeFile(path, JSON.stringify(json), { encoding: 'utf8' }, (err) => {
			return err ? reject(err) : resolve();
		});
	});
}

/**
 * Reads json from file.
 *
 * @param path	Path to json file.
 *
 * @returns Parsed Json.
 */
function readJsonFromFile(path: string): Promise<ObjMap> {
	return new Promise<ObjMap>((resolve, reject) => {
		readFile(path, 'utf8', (err, data) => {
			if (err) {
				return reject(err);
			}
			return resolve(JSON.parse(data));
		});
	});
}

export { writeJsonToFile, readJsonFromFile };
