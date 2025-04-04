import { type Person } from '@thermopylae/dev.unit-test';
import { string } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { IndexedStore, PK_INDEX_NAME } from '../lib/index.js';
import { randomPerson } from './utils.js';

describe(`${IndexedStore.prototype.contains.name} spec`, () => {
	it('should return false when storage is empty', () => {
		const storage = new IndexedStore<Person>();
		expect(storage.contains(PK_INDEX_NAME, string.random())).to.be.eq(false);
	});

	it('should return false when record is in the index', () => {
		const storage = new IndexedStore<Person>();
		const record = randomPerson();
		storage.insert([record]);

		expect(storage.contains(PK_INDEX_NAME, record[PK_INDEX_NAME])).to.be.eq(true);
	});
});
