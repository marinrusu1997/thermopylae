import { describe, it } from 'mocha';
import { Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { number, string } from '@thermopylae/lib.utils';
import dotprop from 'dot-prop';
import { ErrorCodes, IndexedStore, PK_INDEX_NAME } from '../lib';
import { expect, PersonsRepo } from './utils';

describe(`${IndexedStore.prototype.insert.name} spec`, () => {
	it('saves persons without indexing', () => {
		const storage = new IndexedStore<Person>();
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);
	});

	it('saves persons with indexing on level 1 index', () => {
		const storage = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);
	});

	it('saves persons with indexing on level 2 index', () => {
		const storage = new IndexedStore<Person>({ indexes: [PersonIndexes.II_COUNTRY_CODE] });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);
	});

	it('saves persons with indexing on level 3 index', () => {
		const storage = new IndexedStore<Person>({ indexes: [PersonIndexes.III_BANK_NAME] });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);
	});

	it('saves persons with indexing on level 1, 2, 3 index', () => {
		const storage = new IndexedStore<Person>({ indexes: Object.values(PersonIndexes) });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);
	});

	it('fails to insert records which have indexed properties different from indexable types (string|number)', () => {
		const storage = new IndexedStore<Person>();
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		let invalidPerson = {} as Person;

		/** NO ID */
		expect(() => storage.insert([invalidPerson]))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.NULLABLE_PRIMARY_KEY_CANNOT_BE_INDEXED);

		/** ARRAY INDEX */
		storage.createIndexes([PersonIndexes.I_BIRTH_YEAR]);
		invalidPerson = {
			id: string.random(),
			// @ts-ignore
			birthYear: []
		};

		expect(() => storage.insert([invalidPerson]))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INDEX_PROPERTY_INVALID_TYPE);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		/** OBJECT INDEX */
		storage.createIndexes([PersonIndexes.II_COUNTRY_CODE]);
		invalidPerson = {
			id: string.random(),
			birthYear: number.randomInt(1990, 2000),
			address: {
				// @ts-ignore
				countryCode: {}
			}
		};

		expect(() => storage.insert([invalidPerson]))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INDEX_PROPERTY_INVALID_TYPE);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		/** BOOLEAN INDEX */
		storage.createIndexes([PersonIndexes.III_BANK_NAME]);
		invalidPerson = {
			id: string.random(),
			birthYear: number.randomInt(1990, 2000),
			// @ts-ignore
			address: {
				countryCode: string.random()
			},
			finance: {
				bank: {
					// @ts-ignore
					name: true
				}
			}
		};

		expect(() => storage.insert([invalidPerson]))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INDEX_PROPERTY_INVALID_TYPE);
		expect(storage.size).to.be.eq(PersonsRepo.length);
	});

	it('fails to insert duplicate records', () => {
		const storage = new IndexedStore<Person>();
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		expect(() => storage.insert([PersonsRepo[number.randomInt(0, PersonsRepo.length - 1)]]))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.RECORD_EXISTS);
	});

	it('saves records with undefined index properties', () => {
		const indexNames = Object.values(PersonIndexes) as Array<string>;
		const storage = new IndexedStore<Person>({ indexes: indexNames });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		indexNames.push(PK_INDEX_NAME);

		const initialIndexLoad = new Map<string, number>();
		for (const index of indexNames) {
			initialIndexLoad.set(index, storage.readIndex(index).size);
		}

		function generatePerson(nulledIndexName: string): Person {
			const person: Person = { ...PersonsRepo[0] };
			for (const indexName of indexNames) {
				const value = indexName === nulledIndexName ? undefined : string.random();
				dotprop.set(person, indexName, value);
			}
			return person;
		}

		const additions = new Map<string, number>();
		for (const indexName of indexNames) {
			additions.set(indexName, 0);
		}

		function increaseAdditions(nulledIndexName: string): void {
			for (const indexName of indexNames) {
				if (indexName !== nulledIndexName) {
					additions.set(indexName, additions.get(indexName)! + 1);
				}
			}
		}

		for (const nulledIndexName of Object.values(PersonIndexes)) {
			storage.insert([generatePerson(nulledIndexName)]);
			increaseAdditions(nulledIndexName);

			for (const indexName of indexNames) {
				const records = initialIndexLoad.get(indexName)! + additions.get(indexName)!;
				expect(storage.readIndex(indexName).size).to.be.eq(records);
			}
		}
	});

	it('saves records with null index properties', () => {
		const indexNames = Object.values(PersonIndexes) as Array<string>;
		const storage = new IndexedStore<Person>({ indexes: indexNames });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		indexNames.push(PK_INDEX_NAME);

		const initialIndexLoad = new Map<string, number>();
		for (const index of indexNames) {
			initialIndexLoad.set(index, storage.readIndex(index).size);
		}

		function generatePerson(nulledIndexName: string): Person {
			const person: Person = { ...PersonsRepo[0] };
			for (const indexName of indexNames) {
				const value = indexName === nulledIndexName ? null : string.random();
				dotprop.set(person, indexName, value);
			}
			return person;
		}

		const additions = new Map<string, number>();
		for (const indexName of indexNames) {
			additions.set(indexName, 0);
		}

		function increaseAdditions(nulledIndexName: string): void {
			for (const indexName of indexNames) {
				if (indexName !== nulledIndexName) {
					additions.set(indexName, additions.get(indexName)! + 1);
				}
			}
		}

		for (const nulledIndexName of Object.values(PersonIndexes)) {
			storage.insert([generatePerson(nulledIndexName)]);
			increaseAdditions(nulledIndexName);

			for (const indexName of indexNames) {
				const records = initialIndexLoad.get(indexName)! + additions.get(indexName)!;
				expect(storage.readIndex(indexName).size).to.be.eq(records);
			}
		}
	});

	it('saves records partially while error not encountered', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		expect(store.size).to.be.eq(0);

		const validRecordsNo = 3;
		const invalidRecordsNo = 3;

		const toSave = new Array<Person>(validRecordsNo + invalidRecordsNo);
		let i = 0;
		for (; i < validRecordsNo; i++) {
			toSave[i] = PersonsRepo[i];
		}
		for (; i < toSave.length; i++) {
			toSave[i] = { ...PersonsRepo[i] };
			// @ts-ignore
			delete toSave[i].id;
		}

		expect(() => store.insert(toSave))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.NULLABLE_PRIMARY_KEY_CANNOT_BE_INDEXED);
		expect(store.size).to.be.eq(validRecordsNo);
	});
});
