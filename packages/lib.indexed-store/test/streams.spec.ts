import { type Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import cryptoRandomString from 'crypto-random-string';
import { getProperty, setProperty } from 'dot-prop';
// @ts-expect-error This package has no typingsypings
import range from 'range-generator';
import { describe, expect, it } from 'vitest';
import { type IndexValue, IndexedStore, PK_INDEX_NAME } from '../lib/index.js';
import { PersonsRepo, type ReadonlyPerson, randomPerson } from './utils.js';

describe('stream operations spec', () => {
	describe(`${IndexedStore.prototype.map.name} spec`, () => {
		it('should return empty array when storage is empty', () => {
			const storage = new IndexedStore<Person>();

			const mappings = storage.map((person) => person[PK_INDEX_NAME]);
			expect(mappings.length).to.be.eq(0);
		});

		it('should map values from primary index', () => {
			const storage = new IndexedStore<ReadonlyPerson>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const mappings = storage.map((person) => person[PK_INDEX_NAME]);
			expect(mappings.length).to.be.eq(storage.size);

			expect(new Set(mappings).size).to.be.eq(mappings.length);
		});

		it('should map values from secondary index', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			for (const indexName of indexes) {
				// oxlint-disable-next-line no-array-method-this-argument
				const mappings = storage.map((person) => person[PK_INDEX_NAME], indexName);
				expect(mappings.length).to.be.eq(storage.getIndexRecordsCount(indexName));
				expect(new Set(mappings).size).to.be.eq(mappings.length);
			}
		});

		it('should map values from index value', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const candidate = randomPerson();
			const mappings = storage.map((person) => person[PK_INDEX_NAME], PK_INDEX_NAME, candidate[PK_INDEX_NAME]);

			expect(mappings.length).to.be.eq(1);
			expect(mappings[0]).to.be.deep.eq(candidate[PK_INDEX_NAME]);
		});
	});

	describe(`${IndexedStore.prototype.filter.name} spec`, () => {
		it('should filter nothing when storage is empty', () => {
			const storage = new IndexedStore<Person>();

			const filtered = storage.filter(() => true);
			expect(filtered.length).to.be.eq(0);
		});

		it('should filter storage records', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const filtered = storage.filter((person) => person.birthYear === 2000);
			const crossCheckFiltered = PersonsRepo.filter((person) => person.birthYear === 2000);

			expect(filtered.length).to.be.eq(crossCheckFiltered.length);
		});

		it('should filter secondary index records', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const nonIndexed = structuredClone(randomPerson());
			setProperty(nonIndexed, PK_INDEX_NAME, cryptoRandomString({ length: 10 }));
			for (const indexName of indexes) {
				setProperty(nonIndexed, indexName, null);
			}
			storage.insert([nonIndexed]);
			expect(storage.size).to.be.eq(PersonsRepo.length + 1);

			for (const indexName of indexes) {
				// oxlint-disable-next-line no-array-method-this-argument
				const filtered = storage.filter((person) => person.birthYear === 2000, indexName);
				const crossCheckFiltered = PersonsRepo.filter((person) => person.birthYear === 2000);

				expect(filtered.length).to.be.eq(crossCheckFiltered.length);
			}
		});

		it('should filter records from index value', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredBirthYearRange = new Set(range(1990, 1995));
			function predicate(person: ReadonlyPerson): boolean {
				return desiredBirthYearRange.has(person.birthYear);
			}

			const indexVal = getProperty(randomPerson(), PersonIndexes.II_COUNTRY_CODE) as IndexValue;
			const filtered = storage.filter(predicate, PersonIndexes.II_COUNTRY_CODE, indexVal);
			const crossCheckFiltered = PersonsRepo.filter((person) => getProperty(person, PersonIndexes.II_COUNTRY_CODE) === indexVal && predicate(person));

			expect(filtered.length).to.be.eq(crossCheckFiltered.length);
			expect(filtered).to.containSubset(crossCheckFiltered);
		});
	});

	describe(`${IndexedStore.prototype.find.name} spec`, () => {
		it('should find nothing on empty storage', () => {
			const storage = new IndexedStore<Person>();

			const match = storage.find((person) => person.birthYear === 2000);
			expect(match).toBeUndefined();
		});

		it('should find record from storage', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const match = storage.filter((person) => person.birthYear === 2000);
			expect(match).toBeDefined();
		});

		it('should not find non existing record in the storage', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredId = cryptoRandomString({ length: 15 });
			const match = storage.find((person) => person[PK_INDEX_NAME] === desiredId);
			expect(match).toBeUndefined();
		});

		it('should find record in the secondary indexes', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			for (const indexName of indexes) {
				// oxlint-disable-next-line no-array-method-this-argument
				const match = storage.find((person) => person.birthYear === 2000, indexName);
				expect(match).toBeDefined();
			}
		});

		it('should find records from index value', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<ReadonlyPerson>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const record = structuredClone(randomPerson());
			setProperty(record, PK_INDEX_NAME, cryptoRandomString({ length: 5 }));

			const countryCode = cryptoRandomString({ length: 6 });
			setProperty(record, PersonIndexes.I_BIRTH_YEAR, 1990);
			setProperty(record, PersonIndexes.II_COUNTRY_CODE, countryCode);
			storage.insert([record]);

			const desiredBirthYearRange = new Set(range(1990, 1995));
			const match = storage.find((person) => desiredBirthYearRange.has(person.birthYear), PersonIndexes.II_COUNTRY_CODE, countryCode);
			expect(match).to.be.deep.eq(record);
		});
	});
});
