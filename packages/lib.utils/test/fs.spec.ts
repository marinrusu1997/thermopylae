import { unlinkSync } from 'fs';
import { afterEach, assert, describe, expect, it } from 'vitest';
import { readJsonFromFile, writeJsonToFile } from '../lib/fs.js';

describe('fs spec', () => {
	const path = 'file.json';

	afterEach(() => {
		try {
			unlinkSync(path);
		} catch {}
	});

	it('writes json to file, then reads it back', async () => {
		const writeData = { key: 'value' };
		await writeJsonToFile(path, writeData);
		const readData = await readJsonFromFile(path);
		expect(readData).to.be.deep.eq(writeData);
	});

	it('fails to read from invalid location', async () => {
		try {
			await readJsonFromFile('fake.json');
		} catch {
			return;
		}
		assert(false, 'File was read from invalid location');
	});
});
