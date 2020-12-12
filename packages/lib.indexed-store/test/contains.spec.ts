import { describe, it } from 'mocha';
import { Person } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { string } from '@thermopylae/lib.utils';
import { IndexedStore, PK_INDEX_NAME } from '../lib';
import { expect, randomPerson } from './utils';

describe(`${IndexedStore.prototype.contains.name} spec`, () => {
	it('should return false when storage is empty', () => {
		const storage = new IndexedStore<Person>();
		expect(storage.contains(PK_INDEX_NAME, string.ofLength(5))).to.be.eq(false);
	});

	it('should return false when record is in the index', () => {
		const storage = new IndexedStore<Person>();
		const record = randomPerson();
		storage.insert([record]);

		expect(storage.contains(PK_INDEX_NAME, record[PK_INDEX_NAME])).to.be.eq(true);
	});
});
