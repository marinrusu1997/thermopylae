import { beforeEach, describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { array, number, object, string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
import dotprop from 'dot-prop';
// @ts-ignore
import range from 'range-generator';
import { Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { IndexedStore, IndexName, IndexValue, PRIMARY_KEY_INDEX } from '../lib/collections/indexed-store';
import { ErrorCodes } from '../lib/error';
import { Indexes, IndexValueGenerators, Person, providePersonRepository } from './fixtures/persons-repo';

const { expect } = chai;

let PersonsRepo: Array<Person>;

function randomPerson(): Person {
	return array.randomElement(PersonsRepo);
}

const NOT_FOUND_IDX = -1;

describe(`${IndexedStore.name} spec`, () => {
	beforeEach(async () => {
		PersonsRepo = await providePersonRepository();
	});

	describe('constructor', () => {
		it('creates store with primary index', () => {
			let storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);

			storage = new IndexedStore<Person>({ indexes: [] });
			expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);
		});

		it('creates store with secondary indexes', () => {
			const indexes: Array<string> = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			expect(storage.indexes).to.be.containingAllOf(indexes.concat([PRIMARY_KEY_INDEX]));
		});
	});

	describe('index spec', () => {
		// eslint-disable-next-line mocha/no-setup-in-describe
		describe(`${IndexedStore.prototype.createIndexes.name} spec`, () => {
			it('creates no indexes when are passed empty array', () => {
				const storage = new IndexedStore<Person>();
				expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);

				storage.createIndexes([]);
				expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);
			});

			it('creates indexes when array with index names is passed', () => {
				const storage = new IndexedStore<Person>();
				expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);

				const indexes: Array<string> = Object.values(Indexes);
				storage.createIndexes(indexes);
				expect(storage.indexes).to.be.containingAllOf(indexes.concat([PRIMARY_KEY_INDEX]));
			});

			it('does not create duplicate indexes', () => {
				const storage = new IndexedStore<Person>();
				expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);

				const indexes: Array<string> = Object.values(Indexes);
				storage.createIndexes(indexes);
				expect(storage.indexes).to.be.containingAllOf(indexes.concat([PRIMARY_KEY_INDEX]));

				expect(() => storage.createIndexes(indexes))
					.to.throw(Exception)
					.haveOwnProperty('code', ErrorCodes.REDEFINITION);
			});

			it('does not allow primary index redefinition', () => {
				const storage = new IndexedStore<Person>();
				expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);

				expect(() => storage.createIndexes([PRIMARY_KEY_INDEX]))
					.to.throw(Exception)
					.haveOwnProperty('code', ErrorCodes.REDEFINITION);

				expect(storage.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);
			});

			it('indexes records by primary key', () => {
				const storage = new IndexedStore<Person>();
				storage.insert(PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

				const primaryIndex = storage.readIndex(PRIMARY_KEY_INDEX);
				for (const [indexValue, records] of primaryIndex) {
					expect(records).to.be.ofSize(1);
					expect(records[0].id).to.be.eq(indexValue);
				}
			});

			it('re-indexes records when creating level 1 index', () => {
				const storage = new IndexedStore<Person>();
				storage.insert(PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

				storage.createIndexes([Indexes.I_BIRTH_YEAR]);

				const personsPerYear = new Map<number, number>();
				for (const person of PersonsRepo) {
					const no = personsPerYear.get(person.birthYear);
					personsPerYear.set(person.birthYear, no == null ? 1 : no + 1);
				}

				const index = storage.readIndex(Indexes.I_BIRTH_YEAR);
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

				storage.createIndexes([Indexes.II_COUNTRY_CODE]);

				const personsPerCountry = new Map<string, number>();
				for (const person of PersonsRepo) {
					const no = personsPerCountry.get(person.address.countryCode);
					personsPerCountry.set(person.address.countryCode, no == null ? 1 : no + 1);
				}

				const index = storage.readIndex(Indexes.II_COUNTRY_CODE);
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

				storage.createIndexes([Indexes.III_BANK_NAME]);

				const personsPerBank = new Map<string, number>();
				for (const person of PersonsRepo) {
					const no = personsPerBank.get(person.finance.bank.name);
					personsPerBank.set(person.finance.bank.name, no == null ? 1 : no + 1);
				}

				const index = storage.readIndex(Indexes.III_BANK_NAME);
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

				const indexes = Object.values(Indexes);
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

		// eslint-disable-next-line mocha/no-setup-in-describe
		describe(`${IndexedStore.prototype.dropIndex.name} spec`, function () {
			it('fails to drop index which does not exist', () => {
				const store = new IndexedStore<Person>();
				expect(store.dropIndex(string.ofLength(5))).to.be.eq(false);
			});

			it('fails to drop primary index', () => {
				const store = new IndexedStore<Person>();
				expect(() => store.dropIndex(PRIMARY_KEY_INDEX))
					.to.throw(Exception)
					.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);
			});

			it('drops existing index', () => {
				const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
				store.insert(PersonsRepo);
				expect(store.size).to.be.eq(PersonsRepo.length);

				expect(store.indexes).to.be.containingAllOf([PRIMARY_KEY_INDEX, Indexes.I_BIRTH_YEAR]);

				expect(store.dropIndex(Indexes.I_BIRTH_YEAR)).to.be.eq(true);
				expect(store.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);
				expect(store.size).to.be.eq(PersonsRepo.length);
			});

			it('drops multiple existing indexes', () => {
				const indexes = Object.values(Indexes) as Array<string>;
				const store = new IndexedStore<Person>({ indexes });
				store.insert(PersonsRepo);
				expect(store.size).to.be.eq(PersonsRepo.length);

				const originalIndexes = indexes.concat([PRIMARY_KEY_INDEX]);
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

		// eslint-disable-next-line mocha/no-setup-in-describe
		describe(`${IndexedStore.prototype.dropIndexes.name} spec`, function () {
			it('drops nothing when there are no secondary indexes', () => {
				const storage = new IndexedStore<Person>();
				expect(storage.indexes).to.be.ofSize(1);

				storage.dropIndexes();
				expect(storage.indexes).to.be.ofSize(1);
			});

			it('drops all indexes except the primary one when there is no records', () => {
				const indexes = Object.values(Indexes) as Array<string>;
				const storage = new IndexedStore<Person>({ indexes });

				expect(storage.indexes).to.be.ofSize(indexes.length + 1);
				expect(storage.indexes).to.be.containingAllOf(indexes.concat([PRIMARY_KEY_INDEX]));

				storage.dropIndexes();
				expect(storage.indexes).to.be.ofSize(1);
				expect(storage.indexes).to.be.containingAllOf([PRIMARY_KEY_INDEX]);
			});

			it('drops all indexes except the primary one when there are records', () => {
				const indexes = Object.values(Indexes) as Array<string>;
				const storage = new IndexedStore<Person>({ indexes });
				storage.insert(PersonsRepo);

				expect(storage.size).to.be.eq(PersonsRepo.length);
				expect(storage.indexes).to.be.ofSize(indexes.length + 1);
				expect(storage.indexes).to.be.containingAllOf(indexes.concat([PRIMARY_KEY_INDEX]));

				storage.dropIndexes();
				expect(storage.size).to.be.eq(PersonsRepo.length);
				expect(storage.indexes).to.be.ofSize(1);
				expect(storage.indexes).to.be.containingAllOf([PRIMARY_KEY_INDEX]);
			});
		});
	});

	describe(`${IndexedStore.prototype.insert.name} spec`, function () {
		it('saves persons without indexing', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 1 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 2 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.II_COUNTRY_CODE] });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 3 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.III_BANK_NAME] });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 1, 2, 3 index', () => {
			const storage = new IndexedStore<Person>({ indexes: Object.values(Indexes) });
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
				.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);

			/** ARRAY INDEX */
			storage.createIndexes([Indexes.I_BIRTH_YEAR]);
			invalidPerson = {
				id: string.ofLength(5),
				// @ts-ignore
				birthYear: []
			};

			expect(() => storage.insert([invalidPerson]))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			/** OBJECT INDEX */
			storage.createIndexes([Indexes.II_COUNTRY_CODE]);
			invalidPerson = {
				id: string.ofLength(5),
				birthYear: number.randomInt(1990, 2000),
				address: {
					// @ts-ignore
					countryCode: {}
				}
			};

			expect(() => storage.insert([invalidPerson]))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			/** BOOLEAN INDEX */
			storage.createIndexes([Indexes.III_BANK_NAME]);
			invalidPerson = {
				id: string.ofLength(5),
				birthYear: number.randomInt(1990, 2000),
				// @ts-ignore
				address: {
					countryCode: string.ofLength(5)
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
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('fails to insert duplicate records', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			expect(() => storage.insert([PersonsRepo[number.randomInt(0, PersonsRepo.length - 1)]]))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.REDEFINITION);
		});

		it('saves records with undefined index properties', () => {
			const indexNames = Object.values(Indexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes: indexNames });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			indexNames.push(PRIMARY_KEY_INDEX);

			const initialIndexLoad = new Map<string, number>();
			for (const index of indexNames) {
				initialIndexLoad.set(index, storage.readIndex(index).size);
			}

			function generatePerson(nulledIndexName: string): Person {
				const person: Person = { ...PersonsRepo[0] };
				for (const indexName of indexNames) {
					const value = indexName === nulledIndexName ? undefined : string.ofLength(10);
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

			for (const nulledIndexName of Object.values(Indexes)) {
				storage.insert([generatePerson(nulledIndexName)]);
				increaseAdditions(nulledIndexName);

				for (const indexName of indexNames) {
					const records = initialIndexLoad.get(indexName)! + additions.get(indexName)!;
					expect(storage.readIndex(indexName).size).to.be.eq(records);
				}
			}
		});

		it('saves records with null index properties', () => {
			const indexNames = Object.values(Indexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes: indexNames });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			indexNames.push(PRIMARY_KEY_INDEX);

			const initialIndexLoad = new Map<string, number>();
			for (const index of indexNames) {
				initialIndexLoad.set(index, storage.readIndex(index).size);
			}

			function generatePerson(nulledIndexName: string): Person {
				const person: Person = { ...PersonsRepo[0] };
				for (const indexName of indexNames) {
					const value = indexName === nulledIndexName ? null : string.ofLength(10);
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

			for (const nulledIndexName of Object.values(Indexes)) {
				storage.insert([generatePerson(nulledIndexName)]);
				increaseAdditions(nulledIndexName);

				for (const indexName of indexNames) {
					const records = initialIndexLoad.get(indexName)! + additions.get(indexName)!;
					expect(storage.readIndex(indexName).size).to.be.eq(records);
				}
			}
		});

		it('saves records partially while error not encountered', () => {
			const indexes = Object.values(Indexes);
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
				.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);
			expect(store.size).to.be.eq(validRecordsNo);
		});
	});

	describe(`${IndexedStore.prototype.read.name} spec`, () => {
		it('reads records by their id', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const positionGenerator = range(number.randomInt(0, PersonsRepo.length / 10), number.randomInt(PersonsRepo.length / 5, PersonsRepo.length / 2));

			for (const position of positionGenerator) {
				const desired = PersonsRepo[position];
				const records = storage.read(PRIMARY_KEY_INDEX, desired.id);

				expect(records.length).to.be.eq(1);
				expect(records).to.be.containing(desired);
			}
		});

		it('reads records by their index', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const positionGenerator = range(number.randomInt(0, PersonsRepo.length / 10), number.randomInt(PersonsRepo.length / 5, PersonsRepo.length / 2));

			for (const indexName of indexes) {
				for (const position of positionGenerator) {
					const desired = PersonsRepo[position];
					const records = storage.read(indexName, dotprop.get(desired, indexName) as IndexValue);
					const actual = records[records.indexOf(desired)];

					expect(actual).to.be.deep.eq(desired);
				}
			}
		});

		it('reads records from empty storage', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.read(PRIMARY_KEY_INDEX, string.ofLength(5))).to.be.equalTo([]);
		});

		it('reads records from empty index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const person = { ...PersonsRepo[0] };
			dotprop.set(person, Indexes.I_BIRTH_YEAR, null);
			storage.insert([person]);

			expect(storage.read(PRIMARY_KEY_INDEX, person.id)).to.be.equalTo([person]);
			expect(() => storage.read(PRIMARY_KEY_INDEX, person.birthYear))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
		});

		it('fails to read from invalid index', () => {
			const storage = new IndexedStore<Person>();
			expect(() => storage.read(string.ofLength(5), string.ofLength(5)))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
		});
	});

	describe(`${IndexedStore.prototype.readIndex.name} spec`, function () {
		it('reads primary index', () => {
			const store = new IndexedStore<Person>();
			expect(store.readIndex(PRIMARY_KEY_INDEX).size).to.be.eq(0);

			store.insert([PersonsRepo[0]]);
			expect(store.readIndex(PRIMARY_KEY_INDEX).size).to.be.eq(1);
		});

		it('reads secondary indexes', () => {
			const indexes = Object.values(Indexes) as Array<string>;
			const store = new IndexedStore<Person>({ indexes });

			indexes.push(PRIMARY_KEY_INDEX);

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
			expect(() => storage.readIndex(string.ofLength(5)))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
		});
	});

	describe(`${IndexedStore.prototype.contains.name} spec`, function () {
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

	describe(`${IndexedStore.prototype.containsIndex.name} spec`, () => {
		it('should return false when index is not present', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.containsIndex(Indexes.I_BIRTH_YEAR)).to.be.eq(false);
		});

		it('should return true when index is present', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.containsIndex(PRIMARY_KEY_INDEX)).to.be.eq(true);
		});
	});

	describe(`${IndexedStore.prototype.reindex.name} spec`, () => {
		it('should not update primary index', () => {
			const store = new IndexedStore<Person>();

			const oldVal = string.ofLength(5);
			const newVal = string.ofLength(5);
			const reindex = () => store.reindex(PRIMARY_KEY_INDEX, oldVal, newVal, () => true);

			expect(reindex).to.throw(`Can't reindex primary index '${PRIMARY_KEY_INDEX}' value.`);
		});

		it('should throw if values are the same', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const oldVal = '';
			const newVal = oldVal;
			const reindex = () => store.reindex(Indexes.I_BIRTH_YEAR, oldVal, newVal, () => true);

			expect(reindex).to.throw(`New and old values for index '${Indexes.I_BIRTH_YEAR}' are the same: ${JSON.stringify(oldVal)}.`);
		});

		it('should throw if old record was not found (empty index)', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			const originalSize = store.size;

			const candidate = randomPerson();
			const oldVal = dotprop.get(candidate, Indexes.I_BIRTH_YEAR) as IndexValue;
			const newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			const reindex = () => store.reindex(Indexes.I_BIRTH_YEAR, oldVal, newVal, predicate);
			expect(reindex).to.throw(`Failed to de-index record from index '${Indexes.I_BIRTH_YEAR}' with value '${oldVal}', because it wasn't found.`);
			expect(store.size).to.be.eq(originalSize);
		});

		it("should throw record if it doesn't exist", () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert([indexed]);
			const originalSize = store.size;

			const oldVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			let newVal: IndexValue;
			while ((newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!()) === oldVal);

			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX];

			const reindex = () => store.reindex(Indexes.I_BIRTH_YEAR, oldVal, newVal, predicate);
			expect(reindex).to.throw(`Failed to de-index record from index '${Indexes.I_BIRTH_YEAR}' with value '${oldVal}', because it wasn't found.`);
			expect(store.size).to.be.eq(originalSize);
		});

		it('should index record if it was not indexed', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert([indexed]);

			let candidate: Person;
			while ((candidate = randomPerson()) === indexed);

			dotprop.set(candidate, Indexes.I_BIRTH_YEAR, null);
			store.insert([candidate]);

			const originalSize = store.size;
			expect(originalSize).to.be.eq(2);

			const oldVal = dotprop.get(candidate, Indexes.I_BIRTH_YEAR) as IndexValue;
			const newVal = dotprop.get(indexed, Indexes.I_BIRTH_YEAR) as IndexValue;

			store.reindex(Indexes.I_BIRTH_YEAR, oldVal, newVal, candidate[PRIMARY_KEY_INDEX]);
			expect(store.size).to.be.eq(originalSize);

			const indexedRecords = store.read(Indexes.I_BIRTH_YEAR, newVal);
			expect(indexedRecords).to.be.equalTo([indexed, candidate]);
		});

		it('should throw when reindex record that was not indexed before and matcher is not value of primary key', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const record = randomPerson();
			dotprop.delete(record, Indexes.I_BIRTH_YEAR);
			store.insert([record]);

			const oldVal = dotprop.get(record, Indexes.I_BIRTH_YEAR) as IndexValue;
			const newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const matcher = (rec: Person) => rec[PRIMARY_KEY_INDEX] === record[PRIMARY_KEY_INDEX];

			const reindex = () => store.reindex(Indexes.I_BIRTH_YEAR, oldVal, newVal, matcher);
			expect(reindex).to.throw(
				`Matcher needs to be primary key index when indexing record that was not indexed before. Context: index '${
					Indexes.I_BIRTH_YEAR
				}', new value '${JSON.stringify(newVal)}'.`
			);
		});

		it('should throw when reindex record that was not indexed before and it was not found by value of primary index', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const record = randomPerson();
			dotprop.delete(record, Indexes.I_BIRTH_YEAR);
			store.insert([record]);

			const oldVal = dotprop.get(record, Indexes.I_BIRTH_YEAR) as IndexValue;
			const newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const matcher = string.ofLength(10);

			const reindex = () => store.reindex(Indexes.I_BIRTH_YEAR, oldVal, newVal, matcher);
			expect(reindex).to.throw(`No record found for index '${PRIMARY_KEY_INDEX} with matching value '${matcher}'.`);
		});

		it('should update first level index value', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);

			const birthYearIndex = store.readIndex(Indexes.I_BIRTH_YEAR);

			const candidate = randomPerson();
			const oldBirthYear = candidate.birthYear;
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			/** BEFORE REINDEX (assert some invariants) */
			const countryCodeIndexRecordsLenBefore = store.read(Indexes.II_COUNTRY_CODE, candidate.address.countryCode).length;
			const bankNameIndexRecordsLen = store.read(Indexes.III_BANK_NAME, candidate.finance.bank.name).length;
			const originalCandidate = object.cloneDeep(candidate);

			expect(birthYearIndex.get(oldBirthYear)!.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

			/** REINDEX */
			const newBirthYear = number.randomInt(2000, 2020);
			store.reindex(Indexes.I_BIRTH_YEAR, candidate.birthYear, newBirthYear, candidate[PRIMARY_KEY_INDEX]);

			// it not touched record, just reindex it
			expect(originalCandidate).to.be.deep.eq(candidate);
			expect(candidate.birthYear).to.not.be.eq(newBirthYear);

			/** AFTER REINDEX */
			candidate.birthYear = newBirthYear;

			expect(birthYearIndex.get(oldBirthYear)!.findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
			expect(birthYearIndex.get(newBirthYear)!.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

			const countryCodeIndexRecords = store.read(Indexes.II_COUNTRY_CODE, candidate.address.countryCode);
			const bankNameIndexRecords = store.read(Indexes.III_BANK_NAME, originalCandidate.finance.bank.name);

			expect(countryCodeIndexRecordsLenBefore).to.be.eq(countryCodeIndexRecords.length);
			expect(countryCodeIndexRecords.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

			expect(bankNameIndexRecordsLen).to.be.eq(bankNameIndexRecords.length);
			expect(bankNameIndexRecords.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);
		});

		it('should update nested level index', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			const originalSize = store.size;

			for (const indexName of indexes) {
				const originalCandidate = object.cloneDeep(candidate);

				const oldValue = dotprop.get(originalCandidate, indexName) as IndexValue;
				const newValue = IndexValueGenerators.get(indexName)!();

				expect(store.read(indexName, oldValue).findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);
				expect(store.read(indexName, newValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);

				store.reindex(indexName, oldValue, newValue, predicate);
				expect(candidate).to.be.deep.eq(originalCandidate); // it didn't touched record
				expect(dotprop.get(candidate, indexName)).to.not.be.deep.eq(newValue); // and not updated value

				dotprop.set(candidate, indexName, newValue); // update the record

				expect(store.read(indexName, oldValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX); // de-indexed
				expect(store.read(indexName, newValue).findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX); // indexed under new value

				expect(store.size).to.be.eq(originalSize); // nothing changed in records no
			}
		});

		it('should de-index record when new index value is a nullable one', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			const originalSize = store.size;

			for (const indexName of indexes) {
				const originalCandidate = object.cloneDeep(candidate);

				const oldIndexValue = dotprop.get(originalCandidate, indexName) as IndexValue;
				const newIndexValue = null;

				store.reindex(indexName, oldIndexValue, newIndexValue, predicate);
				expect(store.size).to.be.eq(originalSize); // nothing changed in records no

				// record remained untouched
				expect(candidate).to.be.deep.eq(originalCandidate);
				expect(dotprop.get(candidate, indexName)).to.not.be.deep.eq(newIndexValue); // and not updated value

				dotprop.set(candidate, indexName, newIndexValue); // update the record

				// record was de-indexed
				expect(store.read(indexName, oldIndexValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
				expect(() => store.read(indexName, newIndexValue).find(predicate))
					.to.throw(Exception)
					.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			}
		});
	});

	describe(`${IndexedStore.prototype.remove.name} spec`, () => {
		it('should not delete record if index is empty', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			const originalSize = store.size;

			const candidate = randomPerson();
			const indexValue = dotprop.get(candidate, Indexes.I_BIRTH_YEAR) as IndexValue;
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(store.remove(Indexes.I_BIRTH_YEAR, indexValue, predicate)).to.be.eq(undefined);
			expect(store.size).to.be.eq(originalSize);
		});

		it('should not delete record if it is not indexed', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert([indexed]);

			let candidate: Person;
			while ((candidate = randomPerson()) === indexed);

			dotprop.set(candidate, Indexes.I_BIRTH_YEAR, null);
			store.insert([candidate]);

			const originalSize = store.size;
			expect(originalSize).to.be.eq(2);

			const unIndexedVal = dotprop.get(candidate, Indexes.I_BIRTH_YEAR) as IndexValue;
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(() => store.remove(Indexes.I_BIRTH_YEAR, unIndexedVal, predicate))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(store.size).to.be.eq(originalSize);
		});

		it("should not delete record if it doesn't exist under index value", () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert([indexed]);
			const originalSize = store.size;

			const nonExistentVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX];

			expect(store.remove(Indexes.I_BIRTH_YEAR, nonExistentVal, predicate)).to.be.eq(undefined);
			expect(store.size).to.be.eq(originalSize);
		});

		it("should not delete record if it doesn't passed predicate", () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert([indexed]);
			const originalSize = store.size;

			const indexedVal = dotprop.get(indexed, Indexes.I_BIRTH_YEAR) as IndexValue;
			const predicate = () => false;

			expect(store.remove(Indexes.I_BIRTH_YEAR, indexedVal, predicate)).to.be.eq(undefined);
			expect(store.size).to.be.eq(originalSize);
		});

		it('should delete entries from primary index', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX]);
			expect(store.size).to.be.eq(PersonsRepo.length - 1);
			expect(removed).to.be.deep.eq(candidate);

			for (const indexName of indexes) {
				const match = store.read(indexName, dotprop.get(candidate, indexName) as IndexValue)!.find(predicate);
				expect(match).to.be.eq(undefined);
			}
		});

		it('should remove entries from secondary indexes', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);

			expect(store.size).to.be.eq(PersonsRepo.length);

			const removedCandidates = new Set<Person>();

			function candidateForRemoval(): Person {
				let candidate: Person = randomPerson();
				while (removedCandidates.has(candidate)) {
					candidate = randomPerson();
				}
				return candidate;
			}

			function markAsRemoved(candidate: Person): void {
				removedCandidates.add(candidate);
			}

			function assertNotFoundOnAllIndexes(candidate: Person, predicate: UnaryPredicate<Person>): void {
				for (const indexName of indexes) {
					const match = store.read(indexName, dotprop.get(candidate, indexName) as IndexValue)!.find(predicate);
					expect(match).to.be.eq(undefined);
				}
			}

			for (let i = 0; i < indexes.length; i++) {
				const candidate = candidateForRemoval();
				const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
				const removed = store.remove(indexes[i], dotprop.get(candidate, indexes[i]) as IndexValue, predicate);

				expect(store.size).to.be.eq(PersonsRepo.length - i - 1);
				expect(removed).to.be.deep.eq(candidate);
				assertNotFoundOnAllIndexes(candidate, predicate);

				markAsRemoved(candidate);
			}
		});

		it('should be able to insert same record after it was deleted', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			let match: Optional<Person>;

			const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!;
			expect(store.size).to.be.eq(PersonsRepo.length - 1);
			expect(removed).to.be.deep.eq(candidate);
			match = store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!.find(predicate);
			expect(match).to.be.eq(undefined);

			store.insert([removed]);
			expect(store.size).to.be.eq(PersonsRepo.length);
			match = store.read(PRIMARY_KEY_INDEX, removed[PRIMARY_KEY_INDEX])!.find(predicate);
			expect(match).to.be.deep.eq(removed);
		});

		it('throw when predicate is not provided for secondary indexes', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });

			const throwable = () => store.remove(Indexes.I_BIRTH_YEAR, string.ofLength(5));
			expect(throwable).to.throw(Exception).haveOwnProperty('code', ErrorCodes.REQUIRED);
		});

		it('should remove record that was not indexed for one of the indexes', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);

			const candidate = object.cloneDeep(randomPerson());
			dotprop.set(candidate, PRIMARY_KEY_INDEX, string.ofLength(10));
			for (const index of indexes) {
				dotprop.set(candidate, index, null);
			}

			const indexWithVal = Indexes.II_COUNTRY_CODE;
			dotprop.set(candidate, indexWithVal, string.ofLength(2));
			store.insert([candidate]);

			const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX]);

			expect(removed).to.be.deep.eq(candidate);
			expect(store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])).to.be.ofSize(0);

			const predicate = (rec: Person) => rec[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			const indexVal = dotprop.get(candidate, indexWithVal) as IndexValue;
			expect(store.read(indexWithVal, indexVal).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
		});
	});

	describe(`${IndexedStore.prototype.clear.name} spec`, () => {
		it('clears no entries when storage is empty', () => {
			const store = new IndexedStore<Person>();
			expect(store.size).to.be.eq(0);

			store.clear();
			expect(store.size).to.be.eq(0);
		});

		it('clears all entries from storage', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			store.clear();
			expect(store.size).to.be.eq(0);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!.find(predicate)).to.be.eq(undefined);
		});

		it('clears all entries but preserves indexes', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			store.clear();
			expect(store.size).to.be.eq(0);

			for (const indexName of indexes) {
				expect(store.readIndex(indexName)!.size).to.be.eq(0);
			}
		});
	});

	describe(`${IndexedStore.prototype.getIndexRecordsCount.name} spec`, () => {
		it('each index contains distinct records', () => {
			const indexes: Array<IndexName<Person>> = Object.values(Indexes);
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

			indexes.push(PRIMARY_KEY_INDEX);
			for (const indexName of indexes) {
				assertUniqueRecords(indexName);
			}
		});
	});

	describe(`${IndexedStore.prototype.map.name} spec`, () => {
		it('should return empty array when storage is empty', () => {
			const storage = new IndexedStore<Person>();

			function mapper(person: Person): IndexValue {
				return person[PRIMARY_KEY_INDEX];
			}

			const mappings = storage.map(mapper);
			expect(mappings.length).to.be.eq(0);
		});

		it('should map values from primary index', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function mapper(person: Person): IndexValue {
				return person[PRIMARY_KEY_INDEX];
			}

			const mappings = storage.map(mapper);
			expect(mappings.length).to.be.eq(storage.size);

			expect(new Set(mappings).size).to.be.eq(mappings.length);
		});

		it('should map values from secondary index', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function mapper(person: Person): IndexValue {
				return person[PRIMARY_KEY_INDEX];
			}

			for (const indexName of indexes) {
				const mappings = storage.map(mapper, indexName);
				expect(mappings.length).to.be.eq(storage.getIndexRecordsCount(indexName));
				expect(new Set(mappings).size).to.be.eq(mappings.length);
			}
		});

		it('should map values from index value', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			function mapper(person: Person): IndexValue {
				return person[PRIMARY_KEY_INDEX];
			}

			const candidate = randomPerson();
			const mappings = storage.map(mapper, PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX]);

			expect(mappings.length).to.be.eq(1);
			expect(mappings[0]).to.be.deep.eq(candidate[PRIMARY_KEY_INDEX]);
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
			const indexes = Object.values(Indexes);
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
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const nonIndexed = object.cloneDeep(randomPerson());
			dotprop.set(nonIndexed, PRIMARY_KEY_INDEX, string.ofLength(10));
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
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredBirthYearRange = Array.from(range(1990, 1995));
			function predicate(person: Person): boolean {
				return desiredBirthYearRange.includes(person.birthYear);
			}

			const indexVal = dotprop.get(randomPerson(), Indexes.II_COUNTRY_CODE) as IndexValue;
			const filtered = storage.filter(predicate, Indexes.II_COUNTRY_CODE, indexVal);
			const crossCheckFiltered = PersonsRepo.filter((person) => dotprop.get(person, Indexes.II_COUNTRY_CODE) === indexVal && predicate(person));

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
			const indexes = Object.values(Indexes);
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
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredId = string.ofLength(15);
			function predicate(person: Person): boolean {
				return person[PRIMARY_KEY_INDEX] === desiredId;
			}

			const match = storage.find(predicate);
			expect(match).to.be.eq(undefined);
		});

		it('should find record in the secondary indexes', () => {
			const indexes = Object.values(Indexes);
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
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const record = object.cloneDeep(randomPerson());
			dotprop.set(record, PRIMARY_KEY_INDEX, string.ofLength(10));

			const countryCode = string.ofLength(6);
			dotprop.set(record, Indexes.I_BIRTH_YEAR, 1990);
			dotprop.set(record, Indexes.II_COUNTRY_CODE, countryCode);
			storage.insert([record]);

			const desiredBirthYearRange = Array.from(range(1990, 1995));
			function predicate(person: Person): boolean {
				return desiredBirthYearRange.includes(person.birthYear);
			}

			const match = storage.find(predicate, Indexes.II_COUNTRY_CODE, countryCode);
			expect(match).to.be.deep.eq(record);
		});
	});

	describe('values spec', () => {
		it('should return no values when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.values.length).to.be.eq(0);
		});

		it('should return all values from storage', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);

			expect(storage.size).to.be.eq(PersonsRepo.length);
			expect(storage.values.length).to.be.eq(storage.size);
			expect(storage.values).to.be.containingAllOf(PersonsRepo);
		});
	});

	describe('iterator spec', () => {
		it('should iterate over no records when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			let counter = 0;
			for (const _ of storage) {
				counter += 1;
			}
			expect(counter).to.be.eq(0);
		});

		it('should iterate over all records from storage', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const iterated = new Set<Person>();
			for (const record of storage) {
				iterated.add(record);
			}
			expect(iterated.size).to.be.eq(PersonsRepo.length);
		});
	});
});
