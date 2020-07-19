import { before, describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import mocker from 'mocker-data-generator';
import { number, string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
import objectPath from 'object-path';
import { IndexedStore, PRIMARY_KEY_INDEX, Recordable } from '../lib/collections/indexed-store';
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

let PersonsRepo: ReadonlyArray<Person>;

function generateTestData(amount: number): Promise<ReadonlyArray<Person>> {
	return mocker()
		.schema(TRANSACTION_SCHEMA_NAME, TransactionSchema, 10)
		.schema(PERSON_SCHEMA_NAME, PersonSchema, amount)
		.build()
		.then((data) => data[PERSON_SCHEMA_NAME]);
}

// eslint-disable-next-line mocha/no-setup-in-describe
describe.only(`${IndexedStore.name} spec`, function () {
	before(async () => {
		PersonsRepo = await generateTestData(1000);
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
				storage.save(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // save was ok

				const primaryIndex = storage.readIndex(PRIMARY_KEY_INDEX);
				for (const [indexValue, records] of primaryIndex) {
					expect(records).to.be.ofSize(1);
					expect(records[0].id).to.be.eq(indexValue);
				}
			});

			it('re-indexes records when creating level 1 index', () => {
				const storage = new IndexedStore<Person>();
				storage.save(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // save was ok

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
				storage.save(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // save was ok

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
				storage.save(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // save was ok

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
				storage.save(...PersonsRepo);
				expect(storage.size).to.be.eq(PersonsRepo.length); // save was ok

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
				store.save(...PersonsRepo);
				expect(store.size).to.be.eq(PersonsRepo.length);

				expect(store.indexes).to.be.containingAllOf([PRIMARY_KEY_INDEX, Indexes.I_BIRTH_YEAR]);

				expect(store.dropIndex(Indexes.I_BIRTH_YEAR)).to.be.eq(true);
				expect(store.indexes).to.be.equalTo([PRIMARY_KEY_INDEX]);
				expect(store.size).to.be.eq(PersonsRepo.length);
			});

			it('drops multiple existing indexes', () => {
				const indexes = Object.values(Indexes) as Array<string>;
				const store = new IndexedStore<Person>({ indexes });
				store.save(...PersonsRepo);
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
				storage.save(...PersonsRepo);

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
	describe(`${IndexedStore.prototype.save.name} spec`, function () {
		it('saves persons without indexing', () => {
			const storage = new IndexedStore<Person>();
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 1 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.I_BIRTH_YEAR] });
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 2 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.II_COUNTRY_CODE] });
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 3 index', () => {
			const storage = new IndexedStore<Person>({ indexes: [Indexes.III_BANK_NAME] });
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('saves persons with indexing on level 1, 2, 3 index', () => {
			const storage = new IndexedStore<Person>({ indexes: Object.values(Indexes) });
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('fails to save records which have indexed properties different from indexable types (string|number)', () => {
			const storage = new IndexedStore<Person>();
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			let invalidPerson = {};

			/** NO ID */
			// @ts-ignore
			expect(() => storage.save(invalidPerson))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NOT_ALLOWED);

			/** ARRAY INDEX */
			storage.createIndexes([Indexes.I_BIRTH_YEAR]);
			invalidPerson = {
				id: string.generateStringOfLength(5),
				birthYear: []
			};
			// @ts-ignore
			expect(() => storage.save(invalidPerson))
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
			expect(() => storage.save(invalidPerson))
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
			expect(() => storage.save(invalidPerson))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
			expect(storage.size).to.be.eq(PersonsRepo.length);
		});

		it('fails to save duplicate records', () => {
			const storage = new IndexedStore<Person>();
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			expect(() => storage.save(PersonsRepo[number.generateRandomInt(0, PersonsRepo.length - 1)]))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.REDEFINITION);
		});

		it.only('saves records with undefined index properties', () => {
			const indexNames = Object.values(Indexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes: indexNames });
			storage.save(...PersonsRepo);
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
				console.log(person);
				return person;
			}

			let additions = 0;
			for (const nulledIndexName of Object.values(Indexes)) {
				storage.save(generatePerson(nulledIndexName));
				additions += 1;

				for (const indexName of indexNames) {
					if (indexName === nulledIndexName) {
						expect(storage.readIndex(indexName).size).to.be.eq(initialIndexLoad.get(indexName));
						continue;
					}
					expect(storage.readIndex(indexName).size).to.be.eq(initialIndexLoad.get(indexName)! + additions);
				}
			}
		});

		it('saves records with null index properties', () => {
			const originalIndexes = Object.values(Indexes) as Array<string>;
			const storage = new IndexedStore<Person>({ indexes: originalIndexes });
			storage.save(...PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			originalIndexes.push(PRIMARY_KEY_INDEX);

			const initialIndexLoad = new Map<string, number>();
			for (const index of originalIndexes) {
				initialIndexLoad.set(index, storage.readIndex(index).size);
			}

			let additions = 0;
			let person: Person;
			for (const nulledIndex of Object.values(Indexes)) {
				person = Object.assign(PersonsRepo[0], {});
				// @ts-ignore
				person.id = string.generateStringOfLength(5);

				objectPath.set(person, nulledIndex, null);
				storage.save(person);
				additions += 1;

				for (const index of originalIndexes) {
					if (index === nulledIndex) {
						expect(storage.readIndex(index).size).to.be.eq(initialIndexLoad.get(index));
						continue;
					}
					expect(storage.readIndex(index).size).to.be.eq(initialIndexLoad.get(index)! + additions);
				}
			}
		});
	});
});
