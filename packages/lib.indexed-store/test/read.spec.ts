import { type Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { number, string } from '@thermopylae/lib.utils';
import { getProperty, setProperty } from 'dot-prop';
// @ts-ignore This package has no typings
import range from 'range-generator';
import { describe, expect, it } from 'vitest';
import { ErrorCodes, type IndexValue, IndexedStore, PK_INDEX_NAME } from '../lib/index.js';
import { PersonsRepo } from './utils.js';

describe(`${IndexedStore.prototype.read.name} spec`, () => {
	it('reads records by their id', () => {
		const storage = new IndexedStore<Person>();
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		const positionGenerator = range(number.randomInt(0, PersonsRepo.length / 10), number.randomInt(PersonsRepo.length / 5, PersonsRepo.length / 2));

		for (const position of positionGenerator) {
			const desired = PersonsRepo[position];
			const records = storage.read(PK_INDEX_NAME, desired.id);

			expect(records.length).to.be.eq(1);
			expect(records).to.contain(desired);
		}
	});

	it('reads records by their index', () => {
		const indexes = Object.values(PersonIndexes);
		const storage = new IndexedStore<Person>({ indexes });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		const positionGenerator = range(number.randomInt(0, PersonsRepo.length / 10), number.randomInt(PersonsRepo.length / 5, PersonsRepo.length / 2));

		for (const indexName of indexes) {
			for (const position of positionGenerator) {
				const desired = PersonsRepo[position];
				const records = storage.read(indexName, getProperty(desired, indexName) as IndexValue);
				const actual = records[records.indexOf(desired)];

				expect(actual).to.be.deep.eq(desired);
			}
		}
	});

	it('reads records from empty storage', () => {
		const storage = new IndexedStore<Person>();
		expect(storage.read(PK_INDEX_NAME, string.random())).toStrictEqual([]);
	});

	it('reads records from empty index', () => {
		const storage = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const person = { ...PersonsRepo[0] };
		setProperty(person, PersonIndexes.I_BIRTH_YEAR, null);
		storage.insert([person]);

		expect(storage.read(PK_INDEX_NAME, person.id)).toStrictEqual([person]);
		expect(() => storage.read(PK_INDEX_NAME, person.birthYear))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.NULLABLE_INDEX_VALUE_NOT_ALLOWED);
	});

	it('fails to read from invalid index', () => {
		const storage = new IndexedStore<Person>();
		expect(() => storage.read(string.random(), string.random()))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INDEX_NOT_FOUND);
	});
});
