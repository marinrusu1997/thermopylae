import { describe, it } from 'mocha';
import { Person } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { string } from '@thermopylae/lib.utils';
import { IndexedStore, PRIMARY_KEY_INDEX } from '../lib';
import { expect, randomPerson } from './utils';

describe(`${IndexedStore.prototype.contains.name} spec`, () => {
	it('should return false when storage is empty', () => {
		const storage = new IndexedStore<Person>();
		expect(storage.contains(PRIMARY_KEY_INDEX, string.ofLength(5))).to.be.eq(false);
	});

	it('should return false when record is in the index', () => {
		const storage = new IndexedStore<Person>();
		const record = randomPerson();
		storage.insert([record]);

		expect(storage.contains(PRIMARY_KEY_INDEX, record[PRIMARY_KEY_INDEX])).to.be.eq(true);
	});
});
