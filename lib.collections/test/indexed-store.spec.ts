import { before, beforeEach, describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { number, object, string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
import mocker from 'mocker-data-generator';
import objectPath from 'object-path';
// @ts-ignore
import range from 'range-generator';
import { Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { IndexedStore, IndexName, IndexValue, PRIMARY_KEY_INDEX, Recordable } from '../lib/collections/indexed-store';
import { ErrorCodes } from '../lib/error';

const { expect } = chai;

interface Transaction {
	transactionType: string;
	amount: number;
	currencySymbol: string;
}

interface Person extends Recordable {
	firstName: string;
	birthYear: number; // Index (I)
	address: {
		countryCode: string; // Index (II)
		city: string;
	};
	finance: {
		bank: {
			name: string; // Index (III)
		};
		transactions: Array<Transaction>;
	};
}

enum Indexes {
	I_BIRTH_YEAR = 'birthYear',
	II_COUNTRY_CODE = 'address.countryCode',
	III_BANK_NAME = 'finance.bank.name'
}

type IndexValueGenerator = () => IndexValue;
const IndexValueGenerators = new Map<Indexes, IndexValueGenerator>([
	[Indexes.I_BIRTH_YEAR, () => number.generateRandomInt(2000, 2020)],
	[Indexes.II_COUNTRY_CODE, () => string.generateStringOfLength(5)],
	[Indexes.III_BANK_NAME, () => string.generateStringOfLength(5)]
]);

const TRANSACTION_SCHEMA_NAME = 'transaction';
const PERSON_SCHEMA_NAME = 'person';

const TransactionSchema = {
	transactionType: {
		faker: 'finance.transactionType'
	},
	amount: {
		faker: 'finance.amount'
	},
	currencySymbol: {
		faker: 'finance.currencySymbol'
	}
};
const PersonSchema = {
	id: {
		faker: 'random.uuid'
	},
	firstName: {
		faker: 'name.firstName'
	},
	birthYear: {
		function: () => number.generateRandomInt(1990, 2000)
	},
	address: {
		countryCode: {
			faker: 'address.countryCode'
		},
		city: {
			faker: 'address.city'
		}
	},
	finance: {
		bank: {
			name: {
				faker: 'finance.accountName'
			}
		},
		transactions: [
			{
				function(): Transaction {
					// @ts-ignore
					return this.faker.random.arrayElement(this.db[TRANSACTION_SCHEMA_NAME]);
				},
				length: 10,
				fixedLength: false
			}
		]
	}
};

let PersonsRepo: Array<Person>;
let PersonsRepoSnapshot: Array<Person>;

function generateTestData(amount: number): Promise<Array<Person>> {
	return mocker()
		.schema(TRANSACTION_SCHEMA_NAME, TransactionSchema, 10)
		.schema(PERSON_SCHEMA_NAME, PersonSchema, amount)
		.build()
		.then((data) => data[PERSON_SCHEMA_NAME]);
}

function randomPerson(): Person {
	return PersonsRepo[number.generateRandomInt(0, PersonsRepo.length - 1)];
}

// eslint-disable-next-line mocha/no-setup-in-describe
describe(`${IndexedStore.name} spec`, function () {
	before(async () => {
		PersonsRepo = await generateTestData(100);
		PersonsRepoSnapshot = PersonsRepo.map((person) => object.cloneDeep(person));
	});

	beforeEach(() => {
		// this way we remove test inter-dependencies
		PersonsRepo = PersonsRepoSnapshot.map((person) => object.cloneDeep(person));
	});

	describe('constructor', function () {
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

	describe('index spec', function () {
		// eslint-disable-next-line mocha/no-setup-in-describe
		describe(`${IndexedStore.prototype.createIndexes.name} spec`, function () {
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
				storage.insert(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

				const primaryIndex = storage.readIndex(PRIMARY_KEY_INDEX);
				for (const [indexValue, records] of primaryIndex) {
					expect(records).to.be.ofSize(1);
					expect(records[0].id).to.be.eq(indexValue);
				}
			});

			it('re-indexes records when creating level 1 index', () => {
				const storage = new IndexedStore<Person>();
				storage.insert(...PersonsRepo);
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
				storage.insert(...PersonsRepo);
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
				storage.insert(...PersonsRepo);
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
				storage.insert(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // insert was ok

				const indexes = Object.values(Indexes);
				storage.createIndexes(indexes);

				for (const indexName of indexes) {
					const personsPerIndex = new Map<string | number, number>();
					for (const person of PersonsRepo) {
						const indexValue = objectPath.get(person, indexName);
						const no = personsPerIndex.get(indexValue);
						personsPerIndex.set(indexValue, no == null ? 1 : no + 1);
					}

					const storageIndex = storage.readIndex(indexName);
					for (const [indexValue, records] of storageIndex) {
						expect(records.length).to.be.eq(personsPerIndex.get(indexValue));
						for (const record of records) {
							expect(objectPath.get(record, indexName)).to.be.eq(indexValue);
						}
					}
				}
			});
		});

		// eslint-disable-next-line mocha/no-setup-in-describe
		describe(`${IndexedStore.prototype.dropIndex.name} spec`, function () {
			it('fails to drop index which does not exist', () => {
				const store = new IndexedStore<Person>();
				expect(store.dropIndex(string.generateStringOfLength(5))).to.be.eq(false);
			});

			it('fails to drop primary index', () => {
				const store = new IndexedStore<Person>();
				expect(() => store.dropIndex(PRIMARY_KEY_INDEX))
					.to.throw(Exception)
					.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);
			});

			it('drops existing index', () => {
				const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
				store.insert(...PersonsRepo);
				expect(store.size).to.be.eq(PersonsRepo.length);

				expect(store.indexes).to.be.containingAllOf([PRIMARY_KEY_INDEX, Indexes.I_BIRTH_YEAR]);

				expect(store.dropIndex(Indexes.I_BIRTH_YEAR)).to.be.eq(true);
				expect(store.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);
				expect(store.size).to.be.eq(PersonsRepo.length);
			});

			it('drops multiple existing indexes', () => {
				const indexes = Object.values(Indexes) as Array<string>;
				const store = new IndexedStore<Person>({ indexes });
				store.insert(...PersonsRepo);
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
				storage.insert(...PersonsRepo);

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

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${IndexedStore.prototype.insert.name} spec`, function () {
		it('saves persons without indexing', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 1 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 2 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.II_COUNTRY_CODE] });
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 3 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.III_BANK_NAME] });
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 1, 2, 3 index', () => {
			const storage = new IndexedStore<Person>({ indexes: Object.values(Indexes) });
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('fails to insert records which have indexed properties different from indexable types (string|number)', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			let invalidPerson = {};

			/** NO ID */
			// @ts-ignore
			expect(() => storage.insert(invalidPerson))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);

			/** ARRAY INDEX */
			storage.createIndexes([Indexes.I_BIRTH_YEAR]);
			invalidPerson = {
				id: string.generateStringOfLength(5),
				birthYear: []
			};
			// @ts-ignore
			expect(() => storage.insert(invalidPerson))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			/** OBJECT INDEX */
			storage.createIndexes([Indexes.II_COUNTRY_CODE]);
			invalidPerson = {
				id: string.generateStringOfLength(5),
				birthYear: number.generateRandomInt(1990, 2000),
				address: {
					countryCode: {}
				}
			};
			// @ts-ignore
			expect(() => storage.insert(invalidPerson))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			/** BOOLEAN INDEX */
			storage.createIndexes([Indexes.III_BANK_NAME]);
			invalidPerson = {
				id: string.generateStringOfLength(5),
				birthYear: number.generateRandomInt(1990, 2000),
				address: {
					countryCode: string.generateStringOfLength(5)
				},
				finance: {
					bank: {
						name: true
					}
				}
			};
			// @ts-ignore
			expect(() => storage.insert(invalidPerson))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('fails to insert duplicate records', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			expect(() => storage.insert(PersonsRepo[number.generateRandomInt(0, PersonsRepo.length - 1)]))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.REDEFINITION);
		});

		it('saves records with undefined index properties', () => {
			const indexNames = Object.values(Indexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes: indexNames });
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			indexNames.push(PRIMARY_KEY_INDEX);

			const initialIndexLoad = new Map<string, number>();
			for (const index of indexNames) {
				initialIndexLoad.set(index, storage.readIndex(index).size);
			}

			function generatePerson(nulledIndexName: string): Person {
				const person: Person = { ...PersonsRepo[0] };
				for (const indexName of indexNames) {
					const value = indexName === nulledIndexName ? undefined : string.generateStringOfLength(10);
					objectPath.set(person, indexName, value);
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
				storage.insert(generatePerson(nulledIndexName));
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
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			indexNames.push(PRIMARY_KEY_INDEX);

			const initialIndexLoad = new Map<string, number>();
			for (const index of indexNames) {
				initialIndexLoad.set(index, storage.readIndex(index).size);
			}

			function generatePerson(nulledIndexName: string): Person {
				const person: Person = { ...PersonsRepo[0] };
				for (const indexName of indexNames) {
					const value = indexName === nulledIndexName ? null : string.generateStringOfLength(10);
					objectPath.set(person, indexName, value);
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
				storage.insert(generatePerson(nulledIndexName));
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

			// @ts-ignore
			expect(() => store.insert(...toSave))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);
			expect(store.size).to.be.eq(validRecordsNo);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${IndexedStore.prototype.read.name} spec`, function () {
		it('reads records by their id', () => {
			const storage = new IndexedStore<Person>();
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const positionGenerator = range(
				number.generateRandomInt(0, PersonsRepo.length / 10),
				number.generateRandomInt(PersonsRepo.length / 5, PersonsRepo.length / 2)
			);

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
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const positionGenerator = range(
				number.generateRandomInt(0, PersonsRepo.length / 10),
				number.generateRandomInt(PersonsRepo.length / 5, PersonsRepo.length / 2)
			);

			for (const indexName of indexes) {
				for (const position of positionGenerator) {
					const desired = PersonsRepo[position];
					const records = storage.read(indexName, objectPath.get(desired, indexName));
					const actual = records[records.indexOf(desired)];

					expect(actual).to.be.deep.eq(desired);
				}
			}
		});

		it('reads records from empty storage', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.read(PRIMARY_KEY_INDEX, string.generateStringOfLength(5))).to.be.equalTo([]);
		});

		it('reads records from empty index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const person = { ...PersonsRepo[0] };
			objectPath.set(person, Indexes.I_BIRTH_YEAR, null);
			storage.insert(person);

			expect(storage.read(PRIMARY_KEY_INDEX, person.id)).to.be.equalTo([person]);
			expect(storage.read(PRIMARY_KEY_INDEX, person.birthYear)).to.be.equalTo([]);
		});

		it('fails to read from invalid index', () => {
			const storage = new IndexedStore<Person>();
			expect(() => storage.read(string.generateStringOfLength(5), string.generateStringOfLength(5)))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${IndexedStore.prototype.readIndex.name} spec`, function () {
		it('reads primary index', () => {
			const store = new IndexedStore<Person>();
			expect(store.readIndex(PRIMARY_KEY_INDEX).size).to.be.eq(0);

			store.insert(PersonsRepo[0]);
			expect(store.readIndex(PRIMARY_KEY_INDEX).size).to.be.eq(1);
		});

		it('reads secondary indexes', () => {
			const indexes = Object.values(Indexes) as Array<string>;
			const store = new IndexedStore<Person>({ indexes });

			indexes.push(PRIMARY_KEY_INDEX);

			for (const index of indexes) {
				expect(store.readIndex(index).size).to.be.eq(0);
			}

			store.insert(PersonsRepo[0]);

			for (const index of indexes) {
				expect(store.readIndex(index).size).to.be.eq(1);
			}
		});

		it('fails to read invalid index', () => {
			const storage = new IndexedStore<Person>();
			expect(() => storage.readIndex(string.generateStringOfLength(5)))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
		});
	});

	describe('contains spec', function () {
		it('should return false when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.contains(PRIMARY_KEY_INDEX, string.generateStringOfLength(5))).to.be.eq(false);
		});

		it('should return false when record is in the index', () => {
			const storage = new IndexedStore<Person>();
			const record = randomPerson();
			storage.insert(record);

			expect(storage.contains(PRIMARY_KEY_INDEX, record[PRIMARY_KEY_INDEX])).to.be.eq(true);
		});
	});

	describe('contains index spec', function () {
		it('should return false when index is not present', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.containsIndex(Indexes.I_BIRTH_YEAR)).to.be.eq(false);
		});

		it('should return true when index is present', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.containsIndex(PRIMARY_KEY_INDEX)).to.be.eq(true);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${IndexedStore.prototype.updateIndex.name} spec`, function () {
		it('should not update primary index', () => {
			const store = new IndexedStore<Person>();

			const oldVal = string.generateStringOfLength(5);
			const newVal = string.generateStringOfLength(5);
			const update = () => store.updateIndex(PRIMARY_KEY_INDEX, oldVal, newVal, () => true);

			expect(update).to.throw(Exception).haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);
		});

		it('should not update index if values are the same', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const oldVal = '';
			const newVal = oldVal;
			const update = () => store.updateIndex(Indexes.I_BIRTH_YEAR, oldVal, newVal, () => true);

			expect(update()).to.be.eq(false);
		});

		it('should not update index if index is empty', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			const originalSize = store.size;

			const candidate = randomPerson();
			const oldVal = objectPath.get(candidate, Indexes.I_BIRTH_YEAR);
			const newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(store.updateIndex(Indexes.I_BIRTH_YEAR, oldVal, newVal, predicate)).to.be.eq(false);
			expect(store.size).to.be.eq(originalSize);
		});

		it('should not update record if it is not indexed', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert(indexed);

			let candidate: Person;
			while ((candidate = randomPerson()) === indexed);

			objectPath.set(candidate, Indexes.I_BIRTH_YEAR, null);
			store.insert(candidate);

			const originalSize = store.size;
			expect(originalSize).to.be.eq(2);

			const oldVal = objectPath.get(candidate, Indexes.I_BIRTH_YEAR);
			const newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(store.updateIndex(Indexes.I_BIRTH_YEAR, oldVal, newVal, predicate)).to.be.eq(false);
			expect(store.size).to.be.eq(originalSize);

			expect(
				store.updateIndex(
					Indexes.I_BIRTH_YEAR,
					objectPath.get(indexed, Indexes.I_BIRTH_YEAR),
					newVal,
					(person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX]
				)
			).to.be.eq(true);
		});

		it("should not update record if it doesn't exist", () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			const originalIndexed = object.cloneDeep(indexed);

			store.insert(indexed);
			const originalSize = store.size;

			const oldVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const newVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX];

			expect(store.updateIndex(Indexes.I_BIRTH_YEAR, oldVal, newVal, predicate)).to.be.eq(false);
			expect(store.size).to.be.eq(originalSize);
			expect(indexed).to.be.deep.eq(originalIndexed);
		});

		it('should update first level index', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(...PersonsRepo);

			const birthYearIndex = store.readIndex(Indexes.I_BIRTH_YEAR);

			const candidate = randomPerson();
			const oldBirthYearValue = candidate.birthYear;
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			/** BEFORE UPDATE */
			const countryCodeIndexRecordsLenBefore = store.readIndex(Indexes.II_COUNTRY_CODE).get(candidate.address.countryCode)!.length;
			const bankNameIndexRecordsLen = store.readIndex(Indexes.III_BANK_NAME).get(candidate.finance.bank.name)!.length;
			const originalCandidate = object.cloneDeep(candidate);

			expect(birthYearIndex.get(oldBirthYearValue)!.findIndex(predicate)).to.not.be.eq(-1);

			/** UPDATE */
			const updatedBirthYear = number.generateRandomInt(2000, 2020);
			const updated = store.updateIndex(Indexes.I_BIRTH_YEAR, candidate.birthYear, updatedBirthYear, predicate);
			expect(updated).to.be.eq(true);

			expect(originalCandidate).to.not.be.deep.eq(candidate);
			expect(candidate.birthYear).to.be.eq(updatedBirthYear);
			expect({ ...originalCandidate, birthYear: updatedBirthYear }).to.be.deep.eq(candidate);

			/** AFTER UPDATE */
			expect(birthYearIndex.get(oldBirthYearValue)!.findIndex(predicate)).to.be.eq(-1);
			expect(birthYearIndex.get(updatedBirthYear)!.findIndex(predicate)).to.not.be.eq(-1);

			const countryCodeIndexRecords = store.readIndex(Indexes.II_COUNTRY_CODE).get(originalCandidate.address.countryCode)!;
			const bankNameIndexRecords = store.readIndex(Indexes.III_BANK_NAME).get(originalCandidate.finance.bank.name)!;

			expect(countryCodeIndexRecordsLenBefore).to.be.eq(countryCodeIndexRecords.length);
			expect(countryCodeIndexRecords.findIndex(predicate)).to.not.be.eq(-1);

			expect(bankNameIndexRecordsLen).to.be.eq(bankNameIndexRecords.length);
			expect(bankNameIndexRecords.findIndex(predicate)).to.not.be.eq(-1);
		});

		it('should update nested level index', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(...PersonsRepo);

			const candidate = randomPerson();
			const originalCandidate = object.cloneDeep(candidate);
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			const originalSize = store.size;

			for (const indexName of indexes) {
				const oldValue = objectPath.get(originalCandidate, indexName);
				const updateValue = IndexValueGenerators.get(indexName)!();

				expect(store.read(indexName, oldValue)!.findIndex(predicate)).to.not.be.eq(-1);
				expect(store.read(indexName, updateValue)!.findIndex(predicate)).to.be.eq(-1);

				expect(store.updateIndex(indexName, oldValue, updateValue, predicate)).to.be.eq(true);
				expect(candidate).to.not.be.deep.eq(originalCandidate);
				expect(objectPath.get(candidate, indexName)).to.be.deep.eq(updateValue);
				objectPath.set(originalCandidate, indexName, updateValue);
				expect(candidate).to.be.deep.eq(originalCandidate);

				expect(store.read(indexName, oldValue)!.findIndex(predicate)).to.be.eq(-1);
				expect(store.read(indexName, updateValue)!.findIndex(predicate)).to.not.be.eq(-1);

				expect(store.size).to.be.eq(originalSize);
			}
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${IndexedStore.prototype.remove.name} spec`, () => {
		it('should not delete record if index is empty', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			const originalSize = store.size;

			const candidate = randomPerson();
			const indexValue = objectPath.get(candidate, Indexes.I_BIRTH_YEAR);
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(store.remove(Indexes.I_BIRTH_YEAR, indexValue, predicate)).to.be.eq(undefined);
			expect(store.size).to.be.eq(originalSize);
		});

		it('should not delete record if it is not indexed', () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert(indexed);

			let candidate: Person;
			while ((candidate = randomPerson()) === indexed);

			objectPath.set(candidate, Indexes.I_BIRTH_YEAR, null);
			store.insert(candidate);

			const originalSize = store.size;
			expect(originalSize).to.be.eq(2);

			const unIndexedVal = objectPath.get(candidate, Indexes.I_BIRTH_YEAR);
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			expect(store.remove(Indexes.I_BIRTH_YEAR, unIndexedVal, predicate)).to.be.eq(undefined);
			expect(store.size).to.be.eq(originalSize);
		});

		it("should not delete record if it doesn't exist", () => {
			const store = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });

			const indexed = randomPerson();
			store.insert(indexed);
			const originalSize = store.size;

			const nonExistentVal = IndexValueGenerators.get(Indexes.I_BIRTH_YEAR)!();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX];

			expect(store.remove(Indexes.I_BIRTH_YEAR, nonExistentVal, predicate)).to.be.eq(undefined);
			expect(store.size).to.be.eq(originalSize);
		});

		it('should delete entries from primary index', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(...PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

			const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX]);
			expect(store.size).to.be.eq(PersonsRepo.length - 1);
			expect(removed).to.be.deep.eq(candidate);

			for (const indexName of indexes) {
				const match = store.read(indexName, objectPath.get(candidate, indexName))!.find(predicate);
				expect(match).to.be.eq(undefined);
			}
		});

		it('should remove entries from secondary indexes', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(...PersonsRepo);

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
					const match = store.read(indexName, objectPath.get(candidate, indexName))!.find(predicate);
					expect(match).to.be.eq(undefined);
				}
			}

			for (let i = 0; i < indexes.length; i++) {
				const candidate = candidateForRemoval();
				const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
				const removed = store.remove(indexes[i], objectPath.get(candidate, indexes[i]), predicate);

				expect(store.size).to.be.eq(PersonsRepo.length - i - 1);
				expect(removed).to.be.deep.eq(candidate);
				assertNotFoundOnAllIndexes(candidate, predicate);

				markAsRemoved(candidate);
			}
		});

		it('should be able to insert same record after it was deleted', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(...PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			const candidate = randomPerson();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			let match: Optional<Person>;

			const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!;
			expect(store.size).to.be.eq(PersonsRepo.length - 1);
			expect(removed).to.be.deep.eq(candidate);
			match = store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!.find(predicate);
			expect(match).to.be.eq(undefined);

			store.insert(removed);
			expect(store.size).to.be.eq(PersonsRepo.length);
			match = store.read(PRIMARY_KEY_INDEX, removed[PRIMARY_KEY_INDEX])!.find(predicate);
			expect(match).to.be.deep.eq(removed);
		});

		it('throw when predicate is not provided for secondary indexes', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });

			const throwable = () => store.remove(Indexes.I_BIRTH_YEAR, string.generateStringOfLength(5));
			expect(throwable).to.throw(Exception).haveOwnProperty('code', ErrorCodes.REQUIRED);
		});
	});

	describe('clear spec', () => {
		it('clears no entries when storage is empty', () => {
			const store = new IndexedStore<Person>();
			expect(store.size).to.be.eq(0);

			store.clear();
			expect(store.size).to.be.eq(0);
		});

		it('clears all entries from storage', () => {
			const indexes = Object.values(Indexes);
			const store = new IndexedStore<Person>({ indexes });
			store.insert(...PersonsRepo);
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
			store.insert(...PersonsRepo);
			expect(store.size).to.be.eq(PersonsRepo.length);

			store.clear();
			expect(store.size).to.be.eq(0);

			for (const indexName of indexes) {
				expect(store.readIndex(indexName)!.size).to.be.eq(0);
			}
		});
	});

	describe('get index records count spec', function () {
		it('each index contains distinct records', () => {
			const indexes: Array<IndexName<Person>> = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(...PersonsRepo);
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

	describe('map spec', () => {
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
			storage.insert(...PersonsRepo);
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
			storage.insert(...PersonsRepo);
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
			storage.insert(...PersonsRepo);
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

	describe('filter spec', () => {
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
			storage.insert(...PersonsRepo);
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
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const nonIndexed = object.cloneDeep(randomPerson());
			objectPath.set(nonIndexed, PRIMARY_KEY_INDEX, string.generateStringOfLength(10));
			for (const indexName of indexes) {
				objectPath.set(nonIndexed, indexName, null);
			}
			storage.insert(nonIndexed);
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
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredBirthYearRange = Array.from(range(1990, 1995));
			function predicate(person: Person): boolean {
				return desiredBirthYearRange.includes(person.birthYear);
			}

			const filtered = storage.filter(predicate, Indexes.II_COUNTRY_CODE, 'MX');
			const crossCheckFiltered = PersonsRepo.filter((person) => objectPath.get(person, Indexes.II_COUNTRY_CODE) === 'MX' && predicate(person));

			expect(filtered.length).to.be.eq(crossCheckFiltered.length);
			expect(filtered).to.be.containingAllOf(crossCheckFiltered);
		});
	});

	describe('find spec', function () {
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
			storage.insert(...PersonsRepo);
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
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const desiredId = string.generateStringOfLength(15);
			function predicate(person: Person): boolean {
				return person[PRIMARY_KEY_INDEX] === desiredId;
			}

			const match = storage.find(predicate);
			expect(match).to.be.eq(undefined);
		});

		it('should find record in the secondary indexes', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(...PersonsRepo);
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
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const record = object.cloneDeep(randomPerson());
			objectPath.set(record, PRIMARY_KEY_INDEX, string.generateStringOfLength(10));

			const countryCode = string.generateStringOfLength(6);
			objectPath.set(record, Indexes.I_BIRTH_YEAR, 1990);
			objectPath.set(record, Indexes.II_COUNTRY_CODE, countryCode);
			storage.insert(record);

			const desiredBirthYearRange = Array.from(range(1990, 1995));
			function predicate(person: Person): boolean {
				return desiredBirthYearRange.includes(person.birthYear);
			}

			const match = storage.find(predicate, Indexes.II_COUNTRY_CODE, countryCode);
			expect(match).to.be.deep.eq(record);
		});
	});

	describe('values spec', function () {
		it('should return no values when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.values.length).to.be.eq(0);
		});

		it('should return all values from storage', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(...PersonsRepo);

			expect(storage.size).to.be.eq(PersonsRepo.length);
			expect(storage.values.length).to.be.eq(storage.size);
			expect(storage.values).to.be.containingAllOf(PersonsRepo);
		});
	});

	describe('iterator spec', function () {
		it('should iterate over not records when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			let counter = 0;
			for (const _record of storage) {
				counter += 1;
			}
			expect(counter).to.be.eq(0);
		});

		it('should iterate over all records from storage', () => {
			const indexes = Object.values(Indexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const iterated = new Set<Person>();
			for (const record of storage) {
				iterated.add(record);
			}
			expect(iterated.size).to.be.eq(PersonsRepo.length);
		});
	});
});
