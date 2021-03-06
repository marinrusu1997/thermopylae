import { string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
import { Person, PersonIndexes } from '@thermopylae/dev.unit-test';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import dotprop from 'dot-prop';
import { ErrorCodes, IndexedStore, IndexName, IndexValue, PK_INDEX_NAME } from '../lib';
import { expect, PersonsRepo } from './utils';

describe('index spec', () => {
	describe(`${IndexedStore.prototype.createIndexes.name} spec`, () => {
		it('creates no indexes when are passed empty array', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);

			storage.createIndexes([]);
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);
		});

		it('creates indexes when array with index names is passed', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);

			const indexes: Array<string> = Object.values(PersonIndexes);
			storage.createIndexes(indexes);
			expect(storage.indexes).to.be.containingAllOf(indexes.concat([PK_INDEX_NAME]));
		});

		it('does not create duplicate indexes', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);

			const indexes: Array<string> = Object.values(PersonIndexes);
			storage.createIndexes(indexes);
			expect(storage.indexes).to.be.containingAllOf(indexes.concat([PK_INDEX_NAME]));

			expect(() => storage.createIndexes(indexes))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INDEX_EXISTS);
		});

		it('does not allow primary index redefinition', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);

			expect(() => storage.createIndexes([PK_INDEX_NAME]))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INDEX_EXISTS);

			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);
		});

		it('indexes records by primary key', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

			const primaryIndex = storage.readIndex(PK_INDEX_NAME);
			for (const [indexValue, records] of primaryIndex) {
				expect(records).to.be.ofSize(1);
				expect(records[0].id).to.be.eq(indexValue);
			}
		});

		it('re-indexes records when creating level 1 index', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

			storage.createIndexes([PersonIndexes.I_BIRTH_YEAR]);

			const personsPerYear = new Map<number, number>();
			for (const person of PersonsRepo) {
				const no = personsPerYear.get(person.birthYear);
				personsPerYear.set(person.birthYear, no == null ? 1 : no + 1);
			}

			const index = storage.readIndex(PersonIndexes.I_BIRTH_YEAR);
			for (const [indexValue, records] of index) {
				expect(records.length).to.be.eq(personsPerYear.get(indexValue as number));
				for (const record of records) {
					expect(record.birthYear).to.be.eq(indexValue);
				}
			}
		});

		it('re-indexes records when creating level 2 index', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

			storage.createIndexes([PersonIndexes.II_COUNTRY_CODE]);

			const personsPerCountry = new Map<string, number>();
			for (const person of PersonsRepo) {
				const no = personsPerCountry.get(person.address.countryCode);
				personsPerCountry.set(person.address.countryCode, no == null ? 1 : no + 1);
			}

			const index = storage.readIndex(PersonIndexes.II_COUNTRY_CODE);
			for (const [indexValue, records] of index) {
				expect(records.length).to.be.eq(personsPerCountry.get(indexValue as string));
				for (const record of records) {
					expect(record.address.countryCode).to.be.eq(indexValue);
				}
			}
		});

		it('re-indexes records when creating level 3 index', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

			storage.createIndexes([PersonIndexes.III_BANK_NAME]);

			const personsPerBank = new Map<string, number>();
			for (const person of PersonsRepo) {
				const no = personsPerBank.get(person.finance.bank.name);
				personsPerBank.set(person.finance.bank.name, no == null ? 1 : no + 1);
			}

			const index = storage.readIndex(PersonIndexes.III_BANK_NAME);
			for (const [indexValue, records] of index) {
				expect(records.length).to.be.eq(personsPerBank.get(indexValue as string));
				for (const record of records) {
					expect(record.finance.bank.name).to.be.eq(indexValue);
				}
			}
		});

		it('re-indexes records when creating level 1, 2, 3 index', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

			const indexes = Object.values(PersonIndexes);
			storage.createIndexes(indexes);

			for (const indexName of indexes) {
				const personsPerIndex = new Map<string | number, number>();
				for (const person of PersonsRepo) {
					const indexValue = dotprop.get(person, indexName) as NonNullable<IndexValue>;
					const no = personsPerIndex.get(indexValue);
					personsPerIndex.set(indexValue, no == null ? 1 : no + 1);
				}

				const storageIndex = storage.readIndex(indexName);
				for (const [indexValue, records] of storageIndex) {
					expect(records.length).to.be.eq(personsPerIndex.get(indexValue as NonNullable<IndexValue>));
					for (const record of records) {
						expect(dotprop.get(record, indexName)).to.be.eq(indexValue);
					}
				}
			}
		});
	});

	describe(`${IndexedStore.prototype.dropIndex.name} spec`, () => {
		it('fails to drop index which does not exist', () => {
			const store = new IndexedStore<Person>();
			expect(store.dropIndex(string.random())).to.be.eq(false);
		});

		it('fails to drop primary index', () => {
			const store = new IndexedStore<Person>();
			expect(() => store.dropIndex(PK_INDEX_NAME))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.DROPPING_OF_PRIMARY_INDEX_NOT_ALLOWED);
		});

		it('drops existing index', () => {
			const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });
			store.insert(PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			expect(store.indexes).to.be.containingAllOf([PK_INDEX_NAME, PersonIndexes.I_BIRTH_YEAR]);

			expect(store.dropIndex(PersonIndexes.I_BIRTH_YEAR)).to.be.eq(true);
			expect(store.indexes).to.be.equalTo([PK_INDEX_NAME]);
			expect(store.size).to.be.eq(PersonsRepo.length);
		});

		it('drops multiple existing indexes', () => {
			const indexes = Object.values(PersonIndexes) as Array<string>;
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			const originalIndexes = indexes.concat([PK_INDEX_NAME]);
			const originalIndexNo = originalIndexes.length;

			expect(store.indexes).to.be.ofSize(originalIndexNo);
			expect(store.indexes).to.be.containingAllOf(originalIndexes);

			const removals = new Set<string>();
			for (const indexName of indexes) {
				expect(store.dropIndex(indexName)).to.be.eq(true);
				removals.add(indexName);

				expect(store.indexes).to.be.ofSize(originalIndexNo - removals.size);
				expect(store.indexes).to.be.containingAllOf(originalIndexes.filter((i) => !removals.has(i)));

				expect(store.size).to.be.eq(PersonsRepo.length);
			}
		});
	});

	describe(`${IndexedStore.prototype.dropIndexes.name} spec`, () => {
		it('drops nothing when there are no secondary indexes', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.ofSize(1);

			storage.dropIndexes();
			expect(storage.indexes).to.be.ofSize(1);
		});

		it('drops all indexes except the primary one when there is no records', () => {
			const indexes = Object.values(PersonIndexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes });

			expect(storage.indexes).to.be.ofSize(indexes.length + 1);
			expect(storage.indexes).to.be.containingAllOf(indexes.concat([PK_INDEX_NAME]));

			storage.dropIndexes();
			expect(storage.indexes).to.be.ofSize(1);
			expect(storage.indexes).to.be.containingAllOf([PK_INDEX_NAME]);
		});

		it('drops all indexes except the primary one when there are records', () => {
			const indexes = Object.values(PersonIndexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);

			expect(storage.size).to.be.eq(PersonsRepo.length);
			expect(storage.indexes).to.be.ofSize(indexes.length + 1);
			expect(storage.indexes).to.be.containingAllOf(indexes.concat([PK_INDEX_NAME]));

			storage.dropIndexes();
			expect(storage.size).to.be.eq(PersonsRepo.length);
			expect(storage.indexes).to.be.ofSize(1);
			expect(storage.indexes).to.be.containingAllOf([PK_INDEX_NAME]);
		});
	});

	describe(`${IndexedStore.prototype.getIndexRecordsCount.name} spec`, () => {
		it('each index contains distinct records', () => {
			const indexes: Array<IndexName<Person>> = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function assertUniqueRecords(indexName: IndexName<Person>): void {
				const unique = new Set<Person>();
				const index = storage.readIndex(indexName);

				for (const records of index.values()) {
					for (const record of records) {
						unique.add(record);
					}
				}

				expect(unique.size).to.be.eq(storage.getIndexRecordsCount(indexName));
			}

			indexes.push(PK_INDEX_NAME);
			for (const indexName of indexes) {
				assertUniqueRecords(indexName);
			}
		});
	});

	describe(`${IndexedStore.prototype.containsIndex.name} spec`, () => {
		it('should return false when index is not present', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.containsIndex(PersonIndexes.I_BIRTH_YEAR)).to.be.eq(false);
		});

		it('should return true when index is present', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.containsIndex(PK_INDEX_NAME)).to.be.eq(true);
		});
	});

	describe(`${IndexedStore.prototype.readIndex.name} spec`, () => {
		it('reads primary index', () => {
			const store = new IndexedStore<Person>();
			expect(store.readIndex(PK_INDEX_NAME).size).to.be.eq(0);

			store.insert([PersonsRepo[0]]);
			expect(store.readIndex(PK_INDEX_NAME).size).to.be.eq(1);
		});

		it('reads secondary indexes', () => {
			const indexes = Object.values(PersonIndexes) as Array<string>;
			const store = new IndexedStore<Person>({ indexes });

			indexes.push(PK_INDEX_NAME);

			for (const index of indexes) {
				expect(store.readIndex(index).size).to.be.eq(0);
			}

			store.insert([PersonsRepo[0]]);

			for (const index of indexes) {
				expect(store.readIndex(index).size).to.be.eq(1);
			}
		});

		it('fails to read invalid index', () => {
			const storage = new IndexedStore<Person>();
			expect(() => storage.readIndex(string.random()))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INDEX_NOT_FOUND);
		});
	});
});
