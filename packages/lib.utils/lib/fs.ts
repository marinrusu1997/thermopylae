import { readFile, writeFile } from 'node:fs/promises';
import { type JsonCompatible, TypedJson } from './json.js';

/**
 * Writes a JSON to file.
 *
 * @param path Path of the file.
 * @param json Json object to be written.
 */
async function writeJsonToFile<T extends JsonCompatible<T>>(path: string, json: T): Promise<void> {
	await writeFile(path, JSON.stringify(json), { encoding: 'utf8' });
}

/**
 * Reads json from file.
 *
 * @param   path Path to json file.
 *
 * @returns      Parsed Json.
 */
async function readJsonFromFile<T extends JsonCompatible<T>>(path: string): Promise<T> {
	return TypedJson.parse<T>(await readFile(path, 'utf8'));
}

export { writeJsonToFile, readJsonFromFile };
