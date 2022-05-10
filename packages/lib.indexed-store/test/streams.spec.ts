// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import { object, string } from '@thermopylae/lib.utils';
import dotprop from 'dot-prop';
// @ts-ignore This package has no typings
import range from 'range-generator';
import { IndexedStore, IndexValue, PK_INDEX_NAME } from '../lib';
import { expect, PersonsRepo, randomPerson } from './utils';

describe('stream operations spec', () => {
	describe(`${IndexedStore.prototype.map.name} spec`, () => {
		it('should return empty array when storage is empty', () => {
			const storage = new IndexedStore<Person>();

			function mapper(person: Person): IndexValue {
				return person[PK_INDEX_NAME];
			}

			const mappings = storage.map(mapper);
			expect(mappings.length).to.be.eq(0);
		});

		it('should map values from primary index', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function mapper(person: Person): IndexValue {
				return person[PK_INDEX_NAME];
			}

			const mappings = storage.map(mapper);
			expect(mappings.length).to.be.eq(storage.size);

			expect(new Set(mappings).size).to.be.eq(mappings.length);
		});

		it('should map values from secondary index', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function mapper(person: Person): IndexValue {
				return person[PK_INDEX_NAME];
			}

			for (const indexName of indexes) {
				const mappings = storage.map(mapper, indexName);
				expect(mappings.length).to.be.eq(storage.getIndexRecordsCount(indexName));
				expect(new Set(mappings).size).to.be.eq(mappings.length);
			}
		});

		it('should map values from index value', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function mapper(person: Person): IndexValue {
				return person[PK_INDEX_NAME];
			}

			const candidate = randomPerson();
			const mappings = storage.map(mapper, PK_INDEX_NAME, candidate[PK_INDEX_NAME]);

			expect(mappings.length).to.be.eq(1);
			expect(mappings[0]).to.be.deep.eq(candidate[PK_INDEX_NAME]);
		});
	});

	describe(`${IndexedStore.prototype.filter.name} spec`, () => {
		it('should filter nothing when storage is empty', () => {
			const storage = new IndexedStore<Person>();

			function predicate(): boolean {
				return true;
			}

			const filtered = storage.filter(predicate);
			expect(filtered.length).to.be.eq(0);
		});

		it('should filter storage records', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function predicate(person: Person): boolean {
				return person.birthYear === 2000;
			}

			const filtered = storage.filter(predicate);
			const crossCheckFiltered = PersonsRepo.filter(predicate);

			expect(filtered.length).to.be.eq(crossCheckFiltered.length);
		});

		it('should filter secondary index records', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const nonIndexed = object.cloneDeep(randomPerson());
			dotprop.set(nonIndexed, PK_INDEX_NAME, string.random());
			for (const indexName of indexes) {
				dotprop.set(nonIndexed, indexName, null);
			}
			storage.insert([nonIndexed]);
			expect(storage.size).to.be.eq(PersonsRepo.length + 1);

			function predicate(person: Person): boolean {
				return person.birthYear === 2000;
			}

			for (const indexName of indexes) {
				const filtered = storage.filter(predicate, indexName);
				const crossCheckFiltered = PersonsRepo.filter(predicate);

				expect(filtered.length).to.be.eq(crossCheckFiltered.length);
			}
		});

		it('should filter records from index value', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredBirthYearRange = Array.from(range(1990, 1995));
			function predicate(person: Person): boolean {
				return desiredBirthYearRange.includes(person.birthYear);
			}

			const indexVal = dotprop.get(randomPerson(), PersonIndexes.II_COUNTRY_CODE) as IndexValue;
			const filtered = storage.filter(predicate, PersonIndexes.II_COUNTRY_CODE, indexVal);
			const crossCheckFiltered = PersonsRepo.filter((person) => dotprop.get(person, PersonIndexes.II_COUNTRY_CODE) === indexVal && predicate(person));

			expect(filtered.length).to.be.eq(crossCheckFiltered.length);
			expect(filtered).to.be.containingAllOf(crossCheckFiltered);
		});
	});

	describe(`${IndexedStore.prototype.find.name} spec`, () => {
		it('should find nothing on empty storage', () => {
			const storage = new IndexedStore<Person>();
			function predicate(person: Person): boolean {
				return person.birthYear === 2000;
			}
			const match = storage.find(predicate);
			expect(match).to.be.eq(undefined);
		});

		it('should find record from storage', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function predicate(person: Person): boolean {
				return person.birthYear === 2000;
			}

			const match = storage.filter(predicate);
			expect(match).to.not.be.eq(undefined);
		});

		it('should not find non existing record in the storage', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredId = string.random({ length: 15 });
			function predicate(person: Person): boolean {
				return person[PK_INDEX_NAME] === desiredId;
			}

			const match = storage.find(predicate);
			expect(match).to.be.eq(undefined);
		});

		it('should find record in the secondary indexes', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function predicate(person: Person): boolean {
				return person.birthYear === 2000;
			}

			for (const indexName of indexes) {
				const match = storage.find(predicate, indexName);
				expect(match).to.not.be.eq(undefined);
			}
		});

		it('should find records from index value', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const record = object.cloneDeep(randomPerson());
			dotprop.set(record, PK_INDEX_NAME, string.random());

			const countryCode = string.random({ length: 6 });
			dotprop.set(record, PersonIndexes.I_BIRTH_YEAR, 1990);
			dotprop.set(record, PersonIndexes.II_COUNTRY_CODE, countryCode);
			storage.insert([record]);

			const desiredBirthYearRange = Array.from(range(1990, 1995));
			function predicate(person: Person): boolean {
				return desiredBirthYearRange.includes(person.birthYear);
			}

			const match = storage.find(predicate, PersonIndexes.II_COUNTRY_CODE, countryCode);
			expect(match).to.be.deep.eq(record);
		});
	});
});
