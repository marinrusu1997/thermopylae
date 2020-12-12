import { chai } from '@thermopylae/lib.unit-test';
import { describe, it, afterEach } from 'mocha';
import { unlinkSync } from 'fs';
import { writeJsonToFile, readJsonFromFile } from '../lib/fs';

const { expect, assert } = chai;

describe('fs spec', () => {
	const path = 'file.json';

	afterEach(() => {
		try {
			unlinkSync(path);
			// eslint-disable-next-line no-empty
		} catch (e) {}
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
		} catch (e) {
			return;
		}
		assert(false, 'File was read from invalid location');
	});
});
