import { readFile, writeFile } from 'fs';

/**
 * Writes a JSON to file
 *
 * @param path
 * @param json
 */
function writeJsonToFile(path: string, json: object): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		writeFile(path, JSON.stringify(json), { encoding: 'utf8' }, err => {
			return err ? reject(err) : resolve();
		});
	});
}

/**
 * Reads json from specified path
 *
 * @param {string}	path	FS path where json is located.
 */
function readJsonFromFile(path: string): Promise<object> {
	return new Promise<object>((resolve, reject) => {
		readFile(path, 'utf8', (err, data) => {
			if (err) {
				return reject(err);
			}
			return resolve(JSON.parse(data));
		});
	});
}

export { writeJsonToFile, readJsonFromFile };
