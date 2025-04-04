import { type Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import cryptoRandomString from 'crypto-random-string';
import { getProperty, setProperty } from 'dot-prop';
import { randomInt } from 'node:crypto';
// @ts-expect-error This package has no typingsypings
import range from 'range-generator';
import { describe, expect, it } from 'vitest';
import { ErrorCodes, type IndexValue, IndexedStore, PK_INDEX_NAME } from '../lib/index.js';
import { PersonsRepo, type ReadonlyPerson } from './utils.js';

describe(`${IndexedStore.prototype.read.name} spec`, () => {
	it('reads records by their id', () => {
		const storage = new IndexedStore<ReadonlyPerson>();
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		const positionGenerator = range(
			randomInt(0, Math.round(PersonsRepo.length / 10)),
			randomInt(Math.round(PersonsRepo.length / 5), Math.round(PersonsRepo.length / 2))
		);

		for (const position of positionGenerator) {
			const desired = PersonsRepo[position];
			const records = storage.read(PK_INDEX_NAME, desired.id);

			expect(records.length).to.be.eq(1);
			expect(records).to.contain(desired);
		}
	});

	it('reads records by their index', () => {
		const indexes = Object.values(PersonIndexes);
		const storage = new IndexedStore<ReadonlyPerson>({ indexes });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		const positionGenerator = range(
			randomInt(0, Math.round(PersonsRepo.length / 10)),
			randomInt(Math.round(PersonsRepo.length / 5), Math.round(PersonsRepo.length / 2))
		);

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
		expect(storage.read(PK_INDEX_NAME, cryptoRandomString({ length: 5 }))).toStrictEqual([]);
	});

	it('reads records from empty index', () => {
		const storage = new IndexedStore<ReadonlyPerson>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const person = structuredClone(PersonsRepo[0]);
		setProperty(person, PersonIndexes.I_BIRTH_YEAR, null);
		storage.insert([person]);

		expect(storage.read(PK_INDEX_NAME, person.id)).toStrictEqual([person]);
		expect(() => storage.read(PK_INDEX_NAME, person.birthYear))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.NULLABLE_INDEX_VALUE_NOT_ALLOWED);
	});

	it('fails to read from invalid index', () => {
		const storage = new IndexedStore<Person>();
		expect(() => storage.read(cryptoRandomString({ length: 5 }), cryptoRandomString({ length: 5 })))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INDEX_NOT_FOUND);
	});
});
