import type { QueryConditions } from '@b4dnewz/mongodb-operators';
import type { Cloneable, Equals, ObjMap } from '@thermopylae/core.declarations';
import {
	type Address,
	type Finance,
	IndexValueGenerators,
	type Person,
	PersonIndexes,
	PersonJsonSchema,
	type Transaction,
	getPersonRepositoryClone
} from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import type { IndexValue } from '@thermopylae/lib.indexed-store';
import { array, chrono, number, object, string } from '@thermopylae/lib.utils';
import difference from 'array-differ';
// @ts-ignore This package has no typings
import duplicates from 'array-find-duplicates';
import cryptoRandomString from 'crypto-random-string';
import { getProperty, setProperty } from 'dot-prop';
import orderBy from 'lodash.orderby';
import uniqBy from 'lodash.uniqby';
// @ts-ignore This package has no typings
import range from 'range-generator';
import { $enum } from 'ts-enum-util';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	Collection,
	type DocumentNotification,
	DocumentOperation,
	DocumentOriginality,
	type FindOptions,
	type IndexOptions,
	type IndexedKey,
	type KeyOf,
	PK_INDEX_NAME,
	type Projection,
	ProjectionType,
	type Query,
	QueryOperators,
	type ReplaceOptions,
	SortDirection,
	type UpdateOptions
} from '../lib/index.js';

class PersonDocument implements Person, Cloneable<PersonDocument> {
	public readonly id: NonNullable<string>;

	public firstName: string;

	public birthYear: number;

	public address: Address;

	public finance: Finance;

	public visitedCountries: Array<string>;

	public constructor(person: Person) {
		this.id = person[PK_INDEX_NAME]!;
		this.firstName = person.firstName;
		this.address = person.address;
		this.birthYear = person.birthYear;
		this.finance = person.finance;
		this.visitedCountries = person.visitedCountries;
	}

	public clone(): PersonDocument {
		return new PersonDocument(
			object.cloneDeep({
				[PK_INDEX_NAME]: this.id,
				firstName: this.firstName,
				birthYear: this.birthYear,
				address: this.address,
				finance: this.finance,
				visitedCountries: this.visitedCountries
			})
		);
	}
}

let PersonsRepo: Array<PersonDocument>;

function generateTransaction(): Transaction {
	return {
		amount: string.random({ length: 3, allowedCharRegex: /[0-9]/ }),
		currencySymbol: string.random({ length: 1, allowedCharRegex: /\$/ }),
		transactionType: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
	};
}

function generatePersonDocument(): PersonDocument {
	return new PersonDocument({
		[PK_INDEX_NAME]: string.random({ length: 20 }),
		firstName: string.random({ length: 5 }),
		birthYear: number.randomInt(1990, 2000),
		address: {
			countryCode: string.random({ length: 2, allowedCharRegex: /[A-Z]/ }),
			city: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
		},
		finance: {
			bank: {
				name: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
			},
			transactions: array.filledWith(number.randomInt(0, 5), generateTransaction)
		},
		visitedCountries: array.filledWith(number.randomInt(0, 5), () => string.random({ length: 2, allowedCharRegex: /[A-Z]/ }))
	});
}

function randomDocuments(min?: number, max?: number): Array<PersonDocument> {
	return uniqBy(
		array.filledWith(number.randomInt(min || 10, max || 15), () => array.randomElement(PersonsRepo)),
		PK_INDEX_NAME
	);
}

function ordered(matches: Array<PersonDocument>): Array<PersonDocument> {
	return orderBy(matches, [PK_INDEX_NAME], ['asc']);
}

function assertFoundByIndexes(
	collection: Collection<PersonDocument>,
	documents: PersonDocument | Array<PersonDocument>,
	indexed?: Array<IndexedKey<PersonDocument>>,
	nonIndexed?: Array<IndexedKey<PersonDocument>>
): void {
	documents = Array.isArray(documents) ? documents : [documents];
	indexed = indexed == null ? $enum(PersonIndexes).getValues() : indexed;
	nonIndexed = nonIndexed == null ? [] : nonIndexed;

	const equals: Equals<PersonDocument> = (first, second) => first[PK_INDEX_NAME] === second[PK_INDEX_NAME];

	for (const document of documents) {
		for (const index of indexed) {
			const options: Partial<FindOptions<PersonDocument>> = {
				index: { name: index, value: getProperty(document, index) }
			};
			const matches = collection.find(null, options);
			expect(matches).to.contain(document);

			expect(duplicates(matches)).to.have.length(0); // by ref
			expect(duplicates(matches, equals)).to.have.length(0); // by value
		}

		for (const nonIndex of nonIndexed) {
			const options: Partial<FindOptions<PersonDocument>> = {
				index: { name: nonIndex, value: getProperty(document, nonIndex) }
			};
			const matches = collection.find(null, options);
			expect(matches).to.not.contain(document);

			expect(duplicates(matches)).to.have.length(0); // by ref
			expect(duplicates(matches, equals)).to.have.length(0); // by value
		}
	}
}

describe(`${Collection.name} spec`, () => {
	beforeEach(async () => {
		const persons = await getPersonRepositoryClone();
		PersonsRepo = persons.map((person) => new PersonDocument(person));
	});

	describe(`${Collection.prototype.insert.name} spec`, () => {
		it('inserts documents without validating them', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);
		});

		it('inserts documents and validates them with the given schema', () => {
			const collection = new Collection<PersonDocument>({
				schema: PersonJsonSchema
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const person = array.randomElement(PersonsRepo);
			// @ts-ignore This is for test purposes
			delete person.birthYear;

			const throwable = () => collection.insert(new PersonDocument(person));
			expect(throwable).to.throw(Exception).haveOwnProperty('message', 'data must have required property birthYear');
		});

		it('inserts documents and indexes them', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: Object.values(PersonIndexes)
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);
			expect(collection.indexes).to.containSubset(Object.values(PersonIndexes));
		});

		it('inserts document clones', async () => {
			const collection = new Collection<PersonDocument>({
				documentsOriginality: DocumentOriginality.CLONE
			});

			const promise = new Promise<void>((resolve, reject) =>
				collection.watch().subscribe((notification) => {
					try {
						expect(notification.operation).to.be.eq(DocumentOperation.CREATED);
						expect(notification.documents.length).to.be.eq(collection.count);

						const sortedNotificationDocuments = notification.documents.toSorted((p1, p2) => p1.id.localeCompare(p2.id));
						const sortedPersonsRepo = PersonsRepo.toSorted((p1, p2) => p1.id.localeCompare(p2.id));
						for (let i = 0; i < sortedNotificationDocuments.length; i++) {
							expect(sortedNotificationDocuments[i]).not.toBe(sortedPersonsRepo[i]);
							expect(sortedNotificationDocuments[i]).toStrictEqual(sortedPersonsRepo[i]);
						}

						return resolve();
					} catch (e) {
						return reject(e);
					}
				})
			);

			collection.insert(PersonsRepo);
			await promise;
		});

		it('emits notifications with inserted documents', async () => {
			const collection = new Collection<PersonDocument>();

			const promise = new Promise<void>((resolve, reject) =>
				collection.watch().subscribe((notification) => {
					try {
						expect(notification.operation).to.be.eq(DocumentOperation.CREATED);
						expect(notification.documents.length).to.be.eq(collection.count);
						expect(notification.documents).to.containSubset(PersonsRepo);

						return resolve();
					} catch (e) {
						return reject(e);
					}
				})
			);

			collection.insert(PersonsRepo);
			await promise;
		});
	});

	describe(`${Collection.prototype.find.name} spec`, () => {
		describe(`${Collection.prototype.find.name}ById spec`, () => {
			let suiteCollection: Collection<PersonDocument>;

			beforeEach(() => {
				suiteCollection = new Collection<PersonDocument>();
				const docsNo = number.randomInt(5_000, 10_000);

				for (let i = 0; i < docsNo; i++) {
					suiteCollection.insert(generatePersonDocument());
				}

				expect(suiteCollection.count).to.be.eq(docsNo);
			});

			function findSlowly(pk: NonNullable<string>): chrono.TimedExecutionResult<Array<PersonDocument>> {
				const query: Query<PersonDocument> = {
					$or: [{ [PK_INDEX_NAME]: pk }, { [PK_INDEX_NAME]: '' }] // it will never be an empty string
				};
				return chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
			}

			it('should return a single document when providing value of primary key as query', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = desired[PK_INDEX_NAME];
				// these fields from options are ignored
				const options: Partial<FindOptions<PersonDocument>> = {
					multiple: true,
					index: {
						name: PersonIndexes.I_BIRTH_YEAR,
						value: number.randomInt(1990, 2000)
					}
				};

				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query, options);
				expect(measuredMatches.result).toStrictEqual([desired]);

				const slowMeasuredMatches = findSlowly(query);
				expect(slowMeasuredMatches.result).toStrictEqual([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it('should return a single document when providing query and hint to primary index', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: desired[PK_INDEX_NAME]
				};
				const options: Partial<FindOptions<PersonDocument>> = {
					index: {
						name: PK_INDEX_NAME,
						value: desired[PK_INDEX_NAME]
					}
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query, options);
				expect(measuredMatches.result).toStrictEqual([desired]);

				const slowMeasuredMatches = findSlowly(desired[PK_INDEX_NAME]);
				expect(slowMeasuredMatches.result).toStrictEqual([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it('should return a single document when providing query with primary key value (no hint)', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: desired[PK_INDEX_NAME]
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).toStrictEqual([desired]);

				const slowMeasuredMatches = findSlowly(desired[PK_INDEX_NAME]);
				expect(slowMeasuredMatches.result).toStrictEqual([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it(`should return a single document when providing query with primary key value (no hint)`, () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: desired[PK_INDEX_NAME]
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).toStrictEqual([desired]);

				const slowMeasuredMatches = findSlowly(desired[PK_INDEX_NAME]);
				expect(slowMeasuredMatches.result).toStrictEqual([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it(`should return a single document when providing query with primary key and ${QueryOperators.IN} operator with single value in array (no hint)`, () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: {
						$in: [desired[PK_INDEX_NAME]]
					}
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).toStrictEqual([desired]);

				const slowMeasuredMatches = findSlowly(desired[PK_INDEX_NAME]);
				expect(slowMeasuredMatches.result).toStrictEqual([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it(`should return a multiple documents when providing query with primary key and ${QueryOperators.IN} operator with multiple value in array (no hint with index)`, () => {
				const desiredDocuments = uniqBy(
					array.filledWith(number.randomInt(10, 15), () => array.randomElement(suiteCollection.find())),
					PK_INDEX_NAME
				);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: {
						$in: desiredDocuments.map((doc) => doc[PK_INDEX_NAME])
					}
				};
				const matches = suiteCollection.find(query, { multiple: true });

				expect(matches).to.have.length(desiredDocuments.length);
				expect(matches).to.containSubset(desiredDocuments);
			});

			it('should not return document when providing query with primary key and another conditions that are not met by that single document (no hint)', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: desired[PK_INDEX_NAME],
					birthYear: {
						$ne: desired.birthYear
					}
				};
				const matches = suiteCollection.find(query, { multiple: true });

				expect(matches).to.have.length(0);
			});

			it('should not return documents when providing invalid value of primary key as query', () => {
				const query: Query<PersonDocument> = number.randomInt(10, 100);

				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).toStrictEqual([]);

				const slowMeasuredMatches = findSlowly(String(query));
				expect(slowMeasuredMatches.result).toStrictEqual([]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});
		});

		describe('query validation spec', () => {
			it('validates query by default', () => {
				const collection = new Collection<PersonDocument>();

				const query: Query<PersonDocument> = {
					birthYear: {
						$eq: number.randomInt(1990, 2000)
					}
				};

				expect(() => collection.find(query)).to.throw('Invalid query: Unrecognized expression operator: $eq');
			});

			it('validates query explicitly', () => {
				const collection = new Collection<PersonDocument>({
					validateQueries: true
				});

				const query: Query<PersonDocument> = {
					birthYear: {
						$eq: number.randomInt(1990, 2000)
					}
				};

				expect(() => collection.find(query)).to.throw('Invalid query: Unrecognized expression operator: $eq');
			});

			it('does not validate query', () => {
				const collection = new Collection<PersonDocument>({
					validateQueries: false
				});
				collection.insert(PersonsRepo);

				const query: Query<PersonDocument> = {
					birthYear: {
						$eq: number.randomInt(1990, 2000)
					}
				};

				expect(() => collection.find(query)).to.throw('Invalid query: Unrecognized expression operator: undefined');
			});
		});

		it('should return all documents when query is not specified', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const matches = collection.find();
			expect(matches.length).to.be.eq(PersonsRepo.length);
		});

		it('should find a single document matching the query', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PK_INDEX_NAME]: string.random(),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.random({ length: 5 }),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.random({ length: 5 })
				},
				finance: {
					bank: {
						name: string.random({ length: 5 })
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(countryCodes))
			});

			collection.insert(desired);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: desired[PK_INDEX_NAME]
			};

			const matches = collection.find(query);
			expect(matches.length).to.be.eq(1);
			expect(matches[0]).to.be.deep.eq(desired);
		});

		it('should return the first document when multiple docs were matched', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const query: Query<PersonDocument> = {
				birthYear: {
					$in: Array.from(range(1990, 2000))
				}
			};

			const multipleMatches = collection.find(query, { multiple: true });
			expect(multipleMatches.length).to.be.greaterThan(1);

			const singleMatch = collection.find(query, { multiple: false });
			expect(singleMatch).to.have.length(1);
		});

		it('should find a single document matching the predicate', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PK_INDEX_NAME]: string.random({ length: 10 }),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.random({ length: 5 }),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.random({ length: 5 })
				},
				finance: {
					bank: {
						name: string.random({ length: 5 })
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(countryCodes))
			});

			collection.insert(desired);

			function predicate(person: PersonDocument): boolean {
				return person[PK_INDEX_NAME] === desired[PK_INDEX_NAME];
			}

			const matches = collection.find(predicate);
			expect(matches.length).to.be.eq(1);

			for (const match of matches) {
				expect(match.birthYear).to.be.oneOf(Array.from(range(minBirthYear, maxBirthYear + 1))); // upper bound is not inclusive in `range`
				expect(match.address.countryCode).to.be.oneOf(countryCodes);
				expect(match.finance.transactions.some((tx) => tx.currencySymbol === transactionCurrency)).to.be.eq(true);
			}
		});

		it('should find a single document and apply projection', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PK_INDEX_NAME]: string.random(),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.random({ length: 5 }),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.random({ length: 5 })
				},
				finance: {
					bank: {
						name: string.random({ length: 5 })
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(countryCodes))
			});

			collection.insert(desired);

			function predicate(person: PersonDocument): boolean {
				return person[PK_INDEX_NAME] === desired[PK_INDEX_NAME];
			}

			/** EXCLUDE. */
			const excludeProjection: Projection<PersonDocument> = {
				type: ProjectionType.EXCLUDE,
				fields: ['birthYear', 'finance.transactions']
			};
			let matches = collection.find(predicate, { projection: excludeProjection });
			expect(matches.length).to.be.eq(1);

			expect(matches[0]).to.be.instanceOf(PersonDocument);
			expect(matches[0] === desired).to.be.eq(false); // this is a clone
			expect(matches[0]).to.not.be.deep.eq(desired); // created new elem with projection

			expect(matches[0][PK_INDEX_NAME]).to.be.eq(desired[PK_INDEX_NAME]); // just to be confident it found what we need

			for (const excludedProp of excludeProjection.fields) {
				expect(getProperty(matches[0], excludedProp)).to.be.eq(undefined);
			}

			/** INCLUDE. */
			const includeProjection: Projection<PersonDocument> = {
				type: ProjectionType.INCLUDE,
				fields: [PK_INDEX_NAME, 'address.countryCode']
			};
			matches = collection.find(predicate, { projection: includeProjection });
			expect(matches.length).to.be.eq(1);

			expect(matches[0]).to.be.instanceOf(PersonDocument);
			expect(matches[0] === desired).to.be.eq(false); // this is a clone
			expect(matches[0]).to.not.be.deep.eq(desired); // created new elem with projection

			expect(Object.keys(matches[0]).length).to.be.eq(includeProjection.fields.length); // only included fields

			for (const includedProp of includeProjection.fields) {
				expect(getProperty(matches[0], includedProp)).to.be.eq(getProperty(desired, includedProp));
			}
		});

		it('should find a single document and sort it', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const desired = array.randomElement(PersonsRepo);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: desired[PK_INDEX_NAME]
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				sort: {
					birthYear: SortDirection.ASCENDING
				}
			};

			const matches = collection.find(query, options);
			expect(matches).toStrictEqual([desired]);
		});

		it('should find multiple documents and sort them by a single property (ASCENDING)', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				birthYear: {
					$gte: 1990,
					$lt: 2000
				},
				// @ts-ignore This is for test purposes
				'address.countryCode': {
					$in: ['EN', 'RU', 'DE']
				}
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: true,
				sort: {
					birthYear: SortDirection.ASCENDING
				}
			};

			const matches = collection.find(query, options);

			function filter(doc: PersonDocument): boolean {
				const birthYearRange = Array.from(range(getProperty(query.birthYear! as ObjMap, '$gte'), getProperty(query.birthYear! as ObjMap, '$lt')));
				const isInBirthYearRange = birthYearRange.includes(doc.birthYear);

				const countryCode = getProperty(doc, 'address.countryCode');
				// @ts-ignore This is for test purposes
				const isInCountryCodeRange = query['address.countryCode'].$in.includes(countryCode);

				return isInBirthYearRange && isInCountryCodeRange;
			}
			const crossCheck = PersonsRepo.filter(filter);

			// we found all possible values...
			expect(matches.length).to.be.eq(crossCheck.length);
			crossCheck.sort((first, second) => first.birthYear - second.birthYear);

			// ...and they are sorted by birth year
			for (let i = 0; i < matches.length; i++) {
				expect(matches[i]).to.be.deep.eq(crossCheck[i]);
			}
		});

		it('should find multiple documents and sort them by a single property (DESCENDING)', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const query: Query<PersonDocument> = {
				birthYear: {
					$gte: 1990,
					$lt: 1995
				}
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: true,
				sort: {
					firstName: SortDirection.DESCENDING
				}
			};

			const matches = collection.find(query, options);
			expect(matches.length).to.be.gte(2);

			for (let i = 1; i < matches.length; i++) {
				expect(matches[i].firstName.localeCompare(matches[i - 1].firstName)).to.be.lte(0);
			}
		});

		it('should find multiple documents and sort them by multiple properties', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const toBeRetrievedLater = [
				new PersonDocument({
					[PK_INDEX_NAME]: string.random(),
					birthYear: 1995,
					firstName: 'John',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.random({ length: 5 })
					},
					finance: {
						bank: {
							name: string.random({ length: 5 })
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(['EN', 'DE']))
				}),
				new PersonDocument({
					[PK_INDEX_NAME]: string.random(),
					birthYear: 1999,
					firstName: 'John',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.random({ length: 5 })
					},
					finance: {
						bank: {
							name: string.random({ length: 5 })
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(['EN', 'DE']))
				}),
				new PersonDocument({
					[PK_INDEX_NAME]: string.random(),
					birthYear: 1992,
					firstName: 'Clint',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.random({ length: 5 })
					},
					finance: {
						bank: {
							name: string.random({ length: 5 })
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(['EN', 'DE']))
				}),
				new PersonDocument({
					[PK_INDEX_NAME]: string.random(),
					birthYear: 2000,
					firstName: 'Easter',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.random({ length: 5 })
					},
					finance: {
						bank: {
							name: string.random({ length: 5 })
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(['EN', 'DE']))
				})
			];
			collection.insert(toBeRetrievedLater);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: {
					$in: toBeRetrievedLater.map((person) => person[PK_INDEX_NAME])
				}
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: true,
				sort: {
					firstName: SortDirection.DESCENDING,
					birthYear: SortDirection.ASCENDING
				}
			};

			const matches = collection.find(query, options);

			expect(matches.length).to.be.eq(toBeRetrievedLater.length);
			expect(matches).to.containSubset(toBeRetrievedLater);

			for (let i = 1; i < matches.length; i++) {
				expect(matches[i].firstName.localeCompare(matches[i - 1].firstName)).to.be.lte(0); // first sort field

				if (matches[i].firstName === matches[i - 1].firstName) {
					expect(matches[i].birthYear - matches[i - 1].birthYear).to.be.gte(0); // second sort field
				}
			}
		});

		it('should find documents from index and sort them (ASCENDING)', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.I_BIRTH_YEAR]
			});
			collection.insert(PersonsRepo);

			const options: Partial<FindOptions<PersonDocument>> = {
				index: {
					name: PersonIndexes.I_BIRTH_YEAR
				},
				sort: {
					[PersonIndexes.I_BIRTH_YEAR]: SortDirection.ASCENDING
				}
			};
			const matches = collection.find(null, options);
			const crossCheck = orderBy(PersonsRepo, [PersonIndexes.I_BIRTH_YEAR], ['asc']);

			expect(matches).to.have.length(crossCheck.length);
			for (let i = 0; i < crossCheck.length; i++) {
				expect(matches[i]).to.be.eq(crossCheck[i]);
			}
		});

		it('should find documents and sort them on properties that might be null', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.I_BIRTH_YEAR]
			});

			const sortFields: Array<KeyOf<Person>> = ['birthYear', 'firstName'];
			const nullables = [null, undefined];

			const docsNo = number.randomInt(1, 10);
			const documents = new Array<PersonDocument>(docsNo);

			for (let i = 0; i < docsNo; i++) {
				const document = generatePersonDocument();
				setProperty(document, array.randomElement(sortFields), array.randomElement(nullables));
				collection.insert(document);
				documents[i] = document;
			}

			const options: Partial<FindOptions<PersonDocument>> = {
				sort: {
					birthYear: SortDirection.DESCENDING,
					firstName: SortDirection.ASCENDING
				}
			};
			const matches = collection.find(null, options);
			const crossCheck = orderBy(documents, sortFields, ['desc', 'asc']);

			expect(matches).to.have.length(crossCheck.length);
			for (let i = 0; i < crossCheck.length; i++) {
				expect(matches[i]).to.be.eq(crossCheck[i]);
			}
		});

		it('should throw when no sorting fields are given', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const options: Partial<FindOptions<PersonDocument>> = {
				sort: {}
			};

			const throwable = () => collection.find(null, options);
			expect(throwable).to.throw('At leas one sorting field needs to be present. Found: 0.');
		});

		it('should find multiple documents using specified index', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const query: Query<PersonDocument> = {
				// @ts-ignore This is for test purposes
				[PersonIndexes.II_COUNTRY_CODE]: {
					$in: array.filledWith(5, () => getProperty(array.randomElement(PersonsRepo), PersonIndexes.II_COUNTRY_CODE))
				}
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: true,
				index: {
					name: PersonIndexes.II_COUNTRY_CODE
				}
			};

			const matches = collection.find(query, options);
			expect(matches.length).to.be.gt(0);

			const crossCheck = PersonsRepo.filter((person) => {
				// @ts-ignore This is for test purposes
				const expected = query[PersonIndexes.II_COUNTRY_CODE].$in as Array<string>;
				const actual = getProperty(person, PersonIndexes.II_COUNTRY_CODE)!;
				return expected.includes(actual);
			});
			expect(matches).to.containSubset(crossCheck);

			for (const match of matches) {
				const actual = getProperty(match, PersonIndexes.II_COUNTRY_CODE)!;
				// @ts-ignore This is for test purposes
				const expected = query[PersonIndexes.II_COUNTRY_CODE].$in as Array<string>;
				expect(actual).to.be.oneOf(expected);
			}
		});

		it("should find multiple documents using specified index and it's value", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: true,
				index: {
					name: PersonIndexes.II_COUNTRY_CODE,
					value: getProperty(array.randomElement(PersonsRepo), PersonIndexes.II_COUNTRY_CODE)
				}
			};

			const matches = collection.find(null, options);
			expect(matches.length).to.be.gt(0);

			const crossCheck = PersonsRepo.filter((person) => getProperty(person, PersonIndexes.II_COUNTRY_CODE) === options.index!.value);
			expect(matches).to.containSubset(crossCheck);

			for (const match of matches) {
				const actual = getProperty(match, PersonIndexes.II_COUNTRY_CODE)!;
				const expected = options.index!.value;
				expect(actual).to.be.eq(expected);
			}
		});

		it('should find a single document and return a clone of it', () => {
			const collection = new Collection<PersonDocument>({
				documentsOriginality: DocumentOriginality.CLONE
			});
			collection.insert(PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PK_INDEX_NAME]: string.random(),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.random({ length: 5 }),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.random({ length: 5 })
				},
				finance: {
					bank: {
						name: string.random({ length: 5 })
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.randomInt(0, 5), array.randomElement(countryCodes))
			});

			collection.insert(desired);

			const query: Query<PersonDocument> = {
				birthYear: {
					$gte: minBirthYear,
					$lte: maxBirthYear
				},
				// @ts-ignore This is for test purposes
				'address.countryCode': {
					$in: countryCodes
				},
				'finance.transactions': {
					$elemMatch: desired.finance.transactions[0]
				}
			};

			const matches = collection.find(query);
			expect(matches.length).to.be.eq(1);

			expect(matches[0] === desired).to.be.eq(false); // this is a clone
			expect(matches[0][PK_INDEX_NAME]).to.be.eq(desired[PK_INDEX_NAME]);
		});

		it("should not find documents using specified index and it's value, bot not matching on query", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const query: Query<PersonDocument> = {
				// @ts-ignore This is for test purposes
				[PersonIndexes.II_COUNTRY_CODE]: string.random({ length: 5, allowedCharRegex: /[0-9]/ })
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: true,
				index: {
					name: PersonIndexes.II_COUNTRY_CODE,
					value: getProperty(array.randomElement(PersonsRepo), PersonIndexes.II_COUNTRY_CODE)
				}
			};

			const matches = collection.find(query, options);
			expect(matches.length).to.be.eq(0);
		});

		it("should not find documents when query don't match anything", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: string.random({ length: 5, allowedCharRegex: /[0-9]/ })
			};
			const options: Partial<FindOptions<PersonDocument>> = {
				multiple: false,
				index: { name: PersonIndexes.II_COUNTRY_CODE },
				sort: { birthYear: SortDirection.ASCENDING },
				projection: {
					fields: ['finance'],
					type: ProjectionType.EXCLUDE
				}
			};

			const matches = collection.find(query, options);
			expect(matches.length).to.be.eq(0);
		});
	});

	describe(`${Collection.prototype.replace.name} spec`, () => {
		it('should replace a single document', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const replaced = array.randomElement(PersonsRepo);
			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replaced[PK_INDEX_NAME]
			};
			const oldDoc = collection.replace(queryForOldDoc, replacement);

			expect(collection.count).to.be.eq(PersonsRepo.length); // same number of elements remained
			expect(oldDoc).toStrictEqual([replaced]); // returned old doc
			expect(collection.find(queryForOldDoc)).toStrictEqual([]); // removed old doc

			const queryForNewDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replacement[PK_INDEX_NAME]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).toStrictEqual([replacement]); // replaced with new doc
		});

		it('should replace document by id when providing as query the value of id', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const replaced = array.randomElement(PersonsRepo);
			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = replaced[PK_INDEX_NAME];
			const oldDoc = collection.replace(queryForOldDoc, replacement);

			expect(collection.count).to.be.eq(PersonsRepo.length); // same number of elements remained
			expect(oldDoc).toStrictEqual([replaced]); // returned old doc
			expect(collection.find(queryForOldDoc)).toStrictEqual([]); // removed old doc

			const queryForNewDoc: Query<PersonDocument> = replacement[PK_INDEX_NAME];
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).toStrictEqual([replacement]); // replaced with new doc
		});

		it('should replace multiple documents with a single one', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const docsToBeReplaced = randomDocuments();
			const replacement = generatePersonDocument();

			const queryForOldDocs: Query<PersonDocument> = {
				[PK_INDEX_NAME]: {
					$in: docsToBeReplaced.map((doc) => doc[PK_INDEX_NAME])
				}
			};
			const options: Partial<ReplaceOptions<PersonDocument>> = {
				multiple: true,
				index: { name: PK_INDEX_NAME }
			};
			const oldDocs = collection.replace(queryForOldDocs, replacement, options);

			expect(collection.count).to.be.eq(PersonsRepo.length - docsToBeReplaced.length + 1); // number of elements dropped
			expect(oldDocs.length).to.be.eq(docsToBeReplaced.length); // returned all old docs ...
			expect(oldDocs).to.containSubset(docsToBeReplaced); // ... in their exemplars
			expect(collection.find(queryForOldDocs)).toStrictEqual([]); // ... and removed all of them

			const queryForNewDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replacement[PK_INDEX_NAME]
			};
			const newDoc = collection.find(queryForNewDoc, options);

			expect(newDoc).toStrictEqual([replacement]); // replaced with new doc
		});

		it('should upsert replacement if document for given query was not found', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const replaced = generatePersonDocument(); // it's not present
			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replaced[PK_INDEX_NAME]
			};
			const options: Partial<ReplaceOptions<PersonDocument>> = {
				upsert: true
			};
			const oldDoc = collection.replace(queryForOldDoc, replacement, options);

			expect(collection.count).to.be.eq(PersonsRepo.length + 1); // there was an upsert
			expect(oldDoc).toStrictEqual([]); // no old docs found
			expect(collection.find(queryForOldDoc)).toStrictEqual([]); // pedantic check that no old docs are present

			const queryForNewDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replacement[PK_INDEX_NAME]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).toStrictEqual([replacement]); // upserted the replacement
		});

		it('when search options says not to upsert should not upsert replacement if document for given query was not found', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const replaced = generatePersonDocument(); // it's not present
			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replaced[PK_INDEX_NAME]
			};
			const oldDoc = collection.replace(queryForOldDoc, replacement);

			expect(collection.count).to.be.eq(PersonsRepo.length); // old doc not found, so replacement (i.e. upsert) didn't took place
			expect(oldDoc).toStrictEqual([]); // no old docs found

			const queryForNewDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replacement[PK_INDEX_NAME]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).toStrictEqual([]); // replacement was not upserted
		});

		it('should clone replacement when document identity is set to clone', () => {
			const collection = new Collection<PersonDocument>({
				documentsOriginality: DocumentOriginality.CLONE
			});
			collection.insert(PersonsRepo);

			const replaced = array.randomElement(PersonsRepo);
			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replaced[PK_INDEX_NAME]
			};
			collection.replace(queryForOldDoc, replacement);

			const queryForNewDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replacement[PK_INDEX_NAME]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).to.have.length(1);
			expect(newDoc[0]).to.not.be.equal(replacement); // new doc is a clone of replacement ...
			expect(newDoc[0]).to.be.deep.equal(replacement);
			expect(newDoc[0][PK_INDEX_NAME]).to.be.eq(replacement[PK_INDEX_NAME]); // ... although they have the same values
		});

		it('should notify when old document was removed and replaced', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const replaced = array.randomElement(PersonsRepo);
			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: replaced[PK_INDEX_NAME]
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement);

			expect(notifications).to.have.length(2); // delete + insert

			expect(notifications[0].operation).to.be.eq(DocumentOperation.DELETED);
			expect(notifications[0].documents).toStrictEqual([replaced]);
			expect(notifications[0].documents).toStrictEqual(oldDocs); // they are same references

			expect(notifications[1].operation).to.be.eq(DocumentOperation.CREATED);
			expect(notifications[1].documents).toStrictEqual([replacement]);
		});

		it('should notify when replacement was upserted', () => {
			const collection = new Collection<PersonDocument>();
			expect(collection.count).to.be.eq(0);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: string.random({ length: 2 })
			};
			const options: Partial<ReplaceOptions<PersonDocument>> = {
				upsert: true
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement, options);
			expect(oldDocs).to.have.length(0);
			expect(collection.count).to.be.eq(1);

			expect(notifications).to.have.length(1); // insert

			expect(notifications[0].operation).to.be.eq(DocumentOperation.CREATED);
			expect(notifications[0].documents).toStrictEqual([replacement]);
		});

		it('should not notify when replacement was not upserted', () => {
			const collection = new Collection<PersonDocument>();
			expect(collection.count).to.be.eq(0);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const replacement = generatePersonDocument();

			const queryForOldDoc: Query<PersonDocument> = {
				[PK_INDEX_NAME]: string.random({ length: 2 })
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement);
			expect(oldDocs).to.have.length(0);
			expect(collection.count).to.be.eq(0);

			expect(notifications).to.have.length(0);
		});
	});

	describe(`${Collection.prototype.update.name} spec`, () => {
		describe('update validation spec', () => {
			it('should validate update by default', () => {
				const collection = new Collection<PersonDocument>();
				collection.insert(PersonsRepo);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: randomDocuments(1, 1)[0][PK_INDEX_NAME]
				};
				const update = {
					$fff: {
						$bb: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
					}
				};

				const updateOp = () => collection.update(query, update);
				expect(updateOp).to.throw('Invalid update: Unrecognized updated operator: $fff');
			});

			it('should validate update explicitly', () => {
				const collection = new Collection<PersonDocument>({
					validateQueries: true
				});
				collection.insert(PersonsRepo);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: randomDocuments(1, 1)[0][PK_INDEX_NAME]
				};
				const update = {
					$fff: {
						$bb: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
					}
				};

				const updateOp = () => collection.update(query, update);
				expect(updateOp).to.throw('Invalid update: Unrecognized updated operator: $fff');
			});

			it('should not validate update', () => {
				const collection = new Collection<PersonDocument>({
					validateQueries: false
				});
				collection.insert(PersonsRepo);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: randomDocuments(1, 1)[0][PK_INDEX_NAME]
				};
				const update = {
					$fff: {
						$bb: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
					}
				};

				const updateOp = () => collection.update(query, update);
				expect(updateOp).to.not.throw('bla bla');
			});
		});

		it('should update a single document', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = array.randomElement(PersonsRepo);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: toBeUpdated[PK_INDEX_NAME]
			};
			const update = {
				$set: {
					firstName: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
				}
			};

			const originalSnapshot = collection.find(query)[0].clone();

			const oldDoc = collection.update(query, update);
			expect(collection.count).to.be.eq(PersonsRepo.length); // there was just an update

			expect(oldDoc).to.have.length(1);
			expect(oldDoc[0]).not.to.be.equal(toBeUpdated); // it returned a clone of old document...
			expect(oldDoc[0]).not.to.be.deep.equal(toBeUpdated); // ...with different values
			expect(oldDoc[0]).to.be.deep.equal(originalSnapshot); // just to be sure it returned old value

			const updatedDoc = collection.find(query);

			expect(updatedDoc).to.have.length(1);
			expect(updatedDoc[0][PK_INDEX_NAME]).to.be.eq(toBeUpdated[PK_INDEX_NAME]);

			for (const [prop, value] of Object.entries(update.$set)) {
				expect(getProperty(updatedDoc[0], prop)).to.be.deep.eq(value); // ...with updated properties
			}
		});

		it('should update document by id when providing as query the value of id', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const toBeUpdated = array.randomElement(PersonsRepo);

			const query: Query<PersonDocument> = toBeUpdated[PK_INDEX_NAME];
			const update = {
				$set: {
					birthYear: number.randomInt(2000, 2010)
				}
			};

			const oldDoc = collection.update(query, update);
			expect(collection.count).to.be.eq(PersonsRepo.length); // there was just an update

			expect(oldDoc).to.have.length(1);
			expect(oldDoc[0]).not.to.be.equal(toBeUpdated); // it returned a clone of old document...
			expect(oldDoc[0]).not.to.be.deep.equal(toBeUpdated); // ...with different values

			const updatedDoc = collection.find(query);

			expect(updatedDoc).to.have.length(1);
			expect(updatedDoc[0][PK_INDEX_NAME]).to.be.eq(toBeUpdated[PK_INDEX_NAME]);

			for (const [prop, value] of Object.entries(update.$set)) {
				expect(getProperty(updatedDoc[0], prop)).to.be.deep.eq(value); // ...with updated properties
			}
		});

		it('should update multiple documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(2, 5));

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: {
					$in: toBeUpdated.map((doc) => doc[PK_INDEX_NAME])
				}
			};
			const options: Partial<UpdateOptions<PersonDocument>> = {
				multiple: true
			};
			const update = {
				$unset: {
					firstName: ''
				},
				$inc: {
					birthYear: 10
				},
				$rename: {
					'finance.bank.name': 'finance.bank.id'
				},
				$push: {
					'finance.transactions': {
						$each: array.filledWith(2, generateTransaction)
					}
				}
			};

			const originalSnapshots = ordered(collection.find(query, options).map((doc) => doc.clone()));
			expect(originalSnapshots).to.have.length(toBeUpdated.length);

			const oldDocs = ordered(collection.update(query, update, options));
			expect(collection.count).to.be.eq(PersonsRepo.length); // there was just an update

			// returned originals ...
			for (let i = 0; i < originalSnapshots.length; i++) {
				expect(oldDocs[i]).to.be.deep.equal(originalSnapshots[i]); // they are both clones
			}
			expect(oldDocs).not.toStrictEqual(toBeUpdated); // ... and updated in the collection

			const updatedDocs = ordered(collection.find(query, options));

			expect(updatedDocs).toStrictEqual(toBeUpdated); // returned updates
			for (let i = 0; i < updatedDocs.length; i++) {
				// removed property
				expect(getProperty(updatedDocs[i], 'firstName')).to.be.eq(undefined);
				// incremented property
				expect(updatedDocs[i].birthYear).to.be.eq(oldDocs[i].birthYear + 10);
				// renamed property
				expect(getProperty(updatedDocs[i], 'finance.bank.id')).to.be.eq(getProperty(oldDocs[i], 'finance.bank.name'));
				// additional elements
				expect(updatedDocs[i].finance.transactions).to.containSubset(update.$push['finance.transactions'].$each);
			}
		});

		it('should return updated documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = array.randomElement(PersonsRepo);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: toBeUpdated[PK_INDEX_NAME]
			};
			const options: Partial<UpdateOptions<PersonDocument>> = {
				returnUpdated: true
			};
			const update = {
				$pop: {
					'finance.transactions': -1
				}
			};

			const originalSnapshot = collection.find(query)[0].clone();

			const updatedDocs = collection.update(query, update, options);
			expect(updatedDocs).to.have.length(1);

			// returned the update ...
			expect(updatedDocs).not.to.be.eq(originalSnapshot);
			expect(updatedDocs).not.to.be.deep.eq(originalSnapshot);

			// ... with right values
			const updatedTx = orderBy(updatedDocs[0].finance.transactions, ['amount'], ['asc']);
			const slicedOriginalTx = orderBy(originalSnapshot.finance.transactions.slice(1), ['amount'], ['asc']);

			expect(updatedTx).to.have.length(slicedOriginalTx.length);
			for (let i = 0; i < updatedTx.length; i++) {
				expect(updatedTx[i]).to.be.deep.equal(slicedOriginalTx[i]);
			}
		});

		it('should not allow update of the primary index', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const original = array.randomElement(PersonsRepo).clone();

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: original[PK_INDEX_NAME]
			};
			const update = {
				$set: {
					[PK_INDEX_NAME]: string.random({ length: 5 })
				}
			};

			expect(() => collection.update(query, update)).to.throw(`Can't reindex primary index '${PK_INDEX_NAME}' value.`);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const nonExistentDoc = collection.find(query);
			expect(nonExistentDoc).to.have.length(0);
		});

		it('should update indexes when they values are changed', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: Object.values(PersonIndexes)
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(20, 30));

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: {
					$in: toBeUpdated.map((doc) => doc[PK_INDEX_NAME])
				}
			};
			const options: Partial<UpdateOptions<PersonDocument>> = {
				multiple: true,
				returnUpdated: true
			};
			const update = {
				$set: {
					[PersonIndexes.I_BIRTH_YEAR]: number.randomInt(1980, 1990),
					[PersonIndexes.II_COUNTRY_CODE]: string.random({ length: 3, allowedCharRegex: /[A-Z]/ }),
					[PersonIndexes.III_BANK_NAME]: string.random({ length: 5, allowedCharRegex: /[a-zA-Z]/ })
				}
			};

			assertFoundByIndexes(collection, toBeUpdated); // finds by old values of indexes

			const updatedDocs = collection.update(query, update, options);
			expect(updatedDocs).to.have.length(toBeUpdated.length);

			assertFoundByIndexes(collection, updatedDocs); // finds by new values of indexes
		});

		it('should update indexes when one of the updates nullifies index, but another sets it back to new value', () => {
			const indexNames = Object.values(PersonIndexes);
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(20, 30));

			for (const toUpdate of toBeUpdated) {
				assertFoundByIndexes(collection, toUpdate);

				const updatedIdx = array.randomElement(indexNames);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: toUpdate[PK_INDEX_NAME]
				};
				const update = {
					$unset: {
						[updatedIdx]: ''
					},
					$set: {
						[updatedIdx]: IndexValueGenerators.get(updatedIdx)!()
					}
				};

				expect(collection.update(query, update)).to.have.length(1);

				assertFoundByIndexes(collection, toUpdate); // index was updated with new value
			}
		});

		it('should remove indexes when they are nullified', () => {
			const indexNames = Object.values(PersonIndexes);
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(30, 40));
			const nullables = [null, undefined];

			for (const toUpdate of toBeUpdated) {
				assertFoundByIndexes(collection, toUpdate);

				const nullifiedIndex = array.randomElement(indexNames);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: toUpdate[PK_INDEX_NAME]
				};
				const update = {
					$set: {
						[nullifiedIndex]: array.randomElement(nullables)
					}
				};

				expect(collection.update(query, update)).to.have.length(1);

				const nonIndexed = [nullifiedIndex];
				const indexed = difference(indexNames, nonIndexed);
				assertFoundByIndexes(collection, toUpdate, indexed, nonIndexed);
			}
		});

		it('should remove indexes when their property names are removed', () => {
			const indexNames = Object.values(PersonIndexes);
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(30, 40));

			for (const toUpdate of toBeUpdated) {
				assertFoundByIndexes(collection, toUpdate);

				const nullifiedIndex = array.randomElement(indexNames);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: toUpdate[PK_INDEX_NAME]
				};
				const update = {
					$unset: {
						[nullifiedIndex]: ''
					}
				};

				expect(collection.update(query, update)).to.have.length(1);

				const nonIndexed = [nullifiedIndex];
				const indexed = difference(indexNames, nonIndexed);
				assertFoundByIndexes(collection, toUpdate, indexed, nonIndexed);
			}
		});

		it('should remove indexes when their property names are renamed', () => {
			const indexNames = Object.values(PersonIndexes);
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(30, 40));

			for (const toUpdate of toBeUpdated) {
				assertFoundByIndexes(collection, toUpdate);

				const renamedIndex = array.randomElement(indexNames);
				const newName = cryptoRandomString({ length: 5, type: 'alphanumeric' });

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: toUpdate[PK_INDEX_NAME]
				};
				const update = {
					$rename: {
						[renamedIndex]: newName
					}
				};

				expect(collection.update(query, update)).to.have.length(1);

				const nonIndexed = [renamedIndex];
				const indexed = difference(indexNames, nonIndexed);
				assertFoundByIndexes(collection, toUpdate, indexed, nonIndexed);

				const bringNameBackUpdate = {
					$unset: {
						[newName]: ''
					},
					$set: {
						[renamedIndex]: getProperty(toUpdate, newName)
					}
				};
				expect(collection.update(query, bringNameBackUpdate)).to.have.length(1);

				assertFoundByIndexes(collection, toUpdate);
			}
		});

		it('should index again after index removal', () => {
			const indexNames = Object.values(PersonIndexes);
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(30, 40));
			const nullables = [null, undefined];

			for (const toUpdate of toBeUpdated) {
				assertFoundByIndexes(collection, toUpdate);

				const nullifiedIndex = array.randomElement(indexNames);

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: toUpdate[PK_INDEX_NAME]
				};
				const update = {
					$set: {
						[nullifiedIndex]: array.randomElement(nullables)
					}
				};

				expect(collection.update(query, update)).to.have.length(1);

				const nonIndexed = [nullifiedIndex];
				const indexed = difference(indexNames, nonIndexed);
				assertFoundByIndexes(collection, toUpdate, indexed, nonIndexed);

				const createIndexBackUpdate = {
					$set: {
						[nullifiedIndex]: IndexValueGenerators.get(nullifiedIndex)!()
					}
				};

				expect(collection.update(query, createIndexBackUpdate)).to.have.length(1);
				assertFoundByIndexes(collection, toUpdate);
			}
		});

		it('should throw when updates for index cancel each other (i.e. it remains with same value after all updates)', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.I_BIRTH_YEAR]
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(10, 15));

			for (const toUpdate of toBeUpdated) {
				assertFoundByIndexes(collection, toUpdate, [PersonIndexes.I_BIRTH_YEAR]); // it finds it

				const query: Query<PersonDocument> = {
					[PK_INDEX_NAME]: toUpdate[PK_INDEX_NAME]
				};
				const update = {
					$inc: {
						[PersonIndexes.I_BIRTH_YEAR]: 10
					},
					$set: {
						[PersonIndexes.I_BIRTH_YEAR]: getProperty(toUpdate, PersonIndexes.I_BIRTH_YEAR)
					}
				};

				const throwable = () => collection.update(query, update);
				expect(throwable).to.throw(`New and old values for index 'birthYear' are the same: ${getProperty(toUpdate, PersonIndexes.I_BIRTH_YEAR)}.`);

				assertFoundByIndexes(collection, toUpdate, [PersonIndexes.I_BIRTH_YEAR]); // finds it again because it was not modified
			}
		});

		it('should notify with updates', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const toBeUpdated = array.randomElement(PersonsRepo);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: toBeUpdated[PK_INDEX_NAME]
			};
			const update = {
				$set: {
					firstName: string.random({ length: 5, allowedCharRegex: /[A-Za-z]/ })
				}
			};
			const options: Partial<UpdateOptions<PersonDocument>> = {
				returnUpdated: true
			};
			const updatedDocs = collection.update(query, update, options);
			expect(updatedDocs).to.have.length(1);

			expect(notifications).to.have.length(1);
			expect(notifications[0].operation).to.be.eq(DocumentOperation.UPDATED);
			expect(notifications[0].documents).toStrictEqual(updatedDocs);
		});
	});

	describe(`${Collection.prototype.delete.name} spec`, () => {
		it('should delete a single document', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeDeleted = array.randomElement(PersonsRepo);
			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: toBeDeleted[PK_INDEX_NAME]
			};

			const deleted = collection.delete(query);
			expect(collection.count).to.be.eq(PersonsRepo.length - 1); // it was removed
			expect(deleted).toStrictEqual([toBeDeleted]); // the right one

			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.have.length(0);
		});

		it('should delete document by id when providing as query the value of id', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeDeleted = array.randomElement(PersonsRepo);
			const query: Query<PersonDocument> = toBeDeleted[PK_INDEX_NAME];

			const deleted = collection.delete(query);
			expect(collection.count).to.be.eq(PersonsRepo.length - 1); // it was removed
			expect(deleted).toStrictEqual([toBeDeleted]); // the right one

			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.have.length(0);
		});

		it('should delete multiple documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeDeleted = randomDocuments(10, 15);
			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: {
					$in: toBeDeleted.map((doc) => doc[PK_INDEX_NAME])
				}
			};

			const deleted = collection.delete(query);
			expect(collection.count).to.be.eq(PersonsRepo.length - toBeDeleted.length); // it was removed
			expect(deleted).to.have.length(toBeDeleted.length);
			expect(deleted).to.containSubset(toBeDeleted); // the right ones

			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.have.length(0);
		});

		it('should de-index deleted documents', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: $enum(PersonIndexes).getValues()
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeDeleted = randomDocuments(10, 15);
			assertFoundByIndexes(collection, toBeDeleted);

			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: {
					$in: toBeDeleted.map((doc) => doc[PK_INDEX_NAME])
				}
			};
			const deleted = collection.delete(query);
			expect(deleted).to.have.length(toBeDeleted.length);
			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.have.length(0);

			assertFoundByIndexes(collection, toBeDeleted, [], collection.indexes);
		});

		it('should notify about removed documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const toBeDeleted = array.randomElement(PersonsRepo);
			const query: Query<PersonDocument> = {
				[PK_INDEX_NAME]: toBeDeleted[PK_INDEX_NAME]
			};
			const deleted = collection.delete(query);
			expect(deleted).toStrictEqual([toBeDeleted]); // the right one

			expect(notifications).to.have.length(1);
			expect(notifications[0].operation).to.be.eq(DocumentOperation.DELETED);
			expect(notifications[0].documents).toStrictEqual(deleted);
		});
	});

	describe(`${Collection.prototype.clear.name} spec`, () => {
		it('clears all documents', () => {
			const collection = new Collection<PersonDocument>();

			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			collection.clear();
			expect(collection.count).to.be.eq(0);

			expect(collection.find()).toStrictEqual([]);
		});

		it('notifies about clearing', () => {
			const collection = new Collection<PersonDocument>();

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			collection.clear();
			expect(notifications).to.have.length(1);
			expect(notifications[0].operation).to.be.eq(DocumentOperation.CLEARED);
			expect(notifications[0].documents).to.be.eq(null);
		});
	});

	describe(`${Collection.prototype.drop.name} spec`, () => {
		it('clears documents and cancels observables', () => {
			const collection = new Collection<PersonDocument>();

			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			let completions = 0;
			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe({
				next(notification) {
					notifications.push(notification);
				},
				error(err) {
					console.error(err);
				},
				complete() {
					completions += 1;
				}
			});
			collection.watch().subscribe({
				next(notification) {
					notifications.push(notification);
				},
				error(err) {
					console.error(err);
				},
				complete() {
					completions += 1;
				}
			});

			collection.drop();

			expect(notifications).to.have.length(2);
			for (const notification of notifications) {
				expect(notification.operation).to.be.eq(DocumentOperation.CLEARED);
				expect(notification.documents).to.be.eq(null);
			}

			expect(completions).to.be.eq(2);
		});
	});

	describe(`${Collection.prototype.map.name} spec`, () => {
		it('should map all documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const primaryKeys = collection.map((doc) => doc[PK_INDEX_NAME]);
			const primaryKeysCrossCheck = PersonsRepo.map((person) => person[PK_INDEX_NAME]);
			expect(primaryKeys).to.have.length(PersonsRepo.length);
			expect(primaryKeysCrossCheck).to.have.length(PersonsRepo.length);
			expect(primaryKeys).to.containSubset(primaryKeysCrossCheck);
		});

		it('should map documents from index', () => {
			const indexNames = $enum(PersonIndexes).getValues();
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);

			const indexName = array.randomElement(indexNames);
			const indexValue = getProperty(randomDocuments(1, 1)[0], indexName) as IndexValue;
			const options: IndexOptions<PersonDocument> = {
				index: {
					name: indexName,
					value: indexValue
				}
			};
			const primaryKeys = collection.map((doc) => doc[PK_INDEX_NAME], options);

			const primaryKeysCrossCheck = PersonsRepo.filter((person) => getProperty(person, indexName) === indexValue).map((person) => person[PK_INDEX_NAME]);

			expect(primaryKeys).to.have.length(primaryKeysCrossCheck.length);
			expect(primaryKeys).to.containSubset(primaryKeysCrossCheck);
		});
	});

	describe('indexes spec', () => {
		it('should create index', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const indexNames = $enum(PersonIndexes).getValues();
			collection.createIndexes(...indexNames);

			assertFoundByIndexes(collection, PersonsRepo, indexNames);
		});

		it('should create index only if missing', () => {
			const indexNames = $enum(PersonIndexes).getValues();
			const initialIndexes = [PersonIndexes.I_BIRTH_YEAR];

			const collection = new Collection<PersonDocument>({
				indexKeys: initialIndexes
			});
			collection.insert(PersonsRepo);

			for (const index of indexNames) {
				const needsToBeCreated = !initialIndexes.includes(index);
				const created = collection.createIndexIfMissing(index);
				expect(created).to.be.eq(needsToBeCreated);
			}

			assertFoundByIndexes(collection, PersonsRepo, indexNames);
		});

		it('should drop all indexes', () => {
			const indexNames = $enum(PersonIndexes).getValues();
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);

			assertFoundByIndexes(collection, PersonsRepo, indexNames);

			collection.dropIndexes();
			for (const droppedIndex of indexNames) {
				const options: Partial<FindOptions<PersonDocument>> = {
					index: { name: droppedIndex }
				};
				const throwable = () => collection.find(null, options);
				expect(throwable).to.throw(`Property '${droppedIndex}' is not indexed.`);
			}
		});

		it('should drop specified indexes', () => {
			const indexNames = $enum(PersonIndexes).getValues();
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);

			assertFoundByIndexes(collection, PersonsRepo, indexNames);

			const toDrop = [PersonIndexes.I_BIRTH_YEAR, PersonIndexes.III_BANK_NAME];
			collection.dropIndexes(...toDrop);
			assertFoundByIndexes(collection, PersonsRepo, difference(indexNames, toDrop)); // will find only on remained indexes

			for (const droppedIndex of toDrop) {
				const options: Partial<FindOptions<PersonDocument>> = {
					index: { name: droppedIndex }
				};
				const throwable = () => collection.find(null, options);
				expect(throwable).to.throw(`Property '${droppedIndex}' is not indexed.`);
			}
		});
	});

	describe('iterate spec', () => {
		it('should iterate over all entries', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			let iterations = 0;
			for (const document of collection) {
				expect(PersonsRepo).to.contain(document);
				iterations += 1;
			}
			expect(iterations).to.be.eq(PersonsRepo.length);
		});
	});
});
