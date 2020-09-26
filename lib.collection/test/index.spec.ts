import { Cloneable, Equals, ObjMap } from '@thermopylae/core.declarations';
import { array, chrono, number, object, string } from '@thermopylae/lib.utils';
import { IndexValue, PRIMARY_KEY_INDEX } from '@thermopylae/lib.indexed-store';
import { Exception } from '@thermopylae/lib.exception';
import { chai } from '@thermopylae/lib.unit-test';
import {
	Person,
	Address,
	Finance,
	Transaction,
	PersonIndexes,
	IndexValueGenerators,
	PersonJsonSchema,
	getPersonRepositoryClone
} from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { TimedExecutionResult } from '@thermopylae/lib.utils/dist/chrono';
import { beforeEach, describe, it } from 'mocha';
import { $enum } from 'ts-enum-util';
// @ts-ignore
import range from 'range-generator';
import uniqBy from 'lodash.uniqby';
import orderBy from 'lodash.orderby';
import dotProp from 'dot-prop';
import difference from 'array-differ';
// @ts-ignore
import duplicates from 'array-find-duplicates';
import {
	Collection,
	DocumentIdentity,
	DocumentNotification,
	DocumentOperation,
	FindCriteria,
	Projection,
	ProjectionType,
	Query,
	QueryConditions,
	IndexCriteria,
	IndexedKey,
	KeyOf,
	MongooseOperators,
	ReplaceCriteria,
	UpdateCriteria,
	SortDirection
} from '../lib';
import { ErrorCodes } from '../lib/error';

const { expect } = chai;

class PersonDocument implements Person, Cloneable<PersonDocument> {
	public readonly id: NonNullable<IndexValue>;

	public firstName: string;

	public birthYear: number;

	public address: Address;

	public finance: Finance;

	public visitedCountries: Array<string>;

	public constructor(person: Person) {
		this.id = person[PRIMARY_KEY_INDEX]!;
		this.firstName = person.firstName;
		this.address = person.address;
		this.birthYear = person.birthYear;
		this.finance = person.finance;
		this.visitedCountries = person.visitedCountries;
	}

	public clone(): PersonDocument {
		return new PersonDocument(
			object.cloneDeep({
				[PRIMARY_KEY_INDEX]: this.id,
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
		amount: string.ofLength(3, /[0-9]/),
		currencySymbol: string.ofLength(1, /\$/),
		transactionType: string.ofLength(5, /[A-Za-z]/)
	};
}

function generatePersonDocument(): PersonDocument {
	return new PersonDocument({
		[PRIMARY_KEY_INDEX]: string.ofLength(20),
		firstName: string.ofLength(5),
		birthYear: number.randomInt(1990, 2000),
		address: {
			countryCode: string.ofLength(2, /[A-Z]/),
			city: string.ofLength(5, /[A-Za-z]/)
		},
		finance: {
			bank: {
				name: string.ofLength(5, /[A-Za-z]/)
			},
			transactions: array.filledWith(number.randomInt(0, 5), generateTransaction)
		},
		visitedCountries: array.filledWith(number.randomInt(0, 5), () => string.ofLength(2, /[A-Z]/))
	});
}

function randomDocuments(min?: number, max?: number): Array<PersonDocument> {
	return uniqBy(
		array.filledWith(number.randomInt(min || 10, max || 15), () => array.randomElement(PersonsRepo)),
		PRIMARY_KEY_INDEX
	);
}

function ordered(matches: Array<PersonDocument>): Array<PersonDocument> {
	return orderBy(matches, [PRIMARY_KEY_INDEX], ['asc']);
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

	const equals: Equals<PersonDocument> = (first, second) => first[PRIMARY_KEY_INDEX] === second[PRIMARY_KEY_INDEX];

	for (const document of documents) {
		for (const index of indexed) {
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				index: { key: index, value: dotProp.get(document, index) }
			};
			const matches = collection.find(null, criteria);
			expect(matches).to.be.containing(document);

			expect(duplicates(matches)).to.be.ofSize(0); // by ref
			expect(duplicates(matches, equals)).to.be.ofSize(0); // by value
		}

		for (const nonIndex of nonIndexed) {
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				index: { key: nonIndex, value: dotProp.get(document, nonIndex) }
			};
			const matches = collection.find(null, criteria);
			expect(matches).to.not.be.containing(document);

			expect(duplicates(matches)).to.be.ofSize(0); // by ref
			expect(duplicates(matches, equals)).to.be.ofSize(0); // by value
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
			// @ts-ignore
			delete person.birthYear;

			const throwable = () => collection.insert(new PersonDocument(person));
			expect(throwable).to.throw(Exception).haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
		});

		it('inserts documents and indexes them', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: Object.values(PersonIndexes)
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);
			expect(collection.indexes).to.be.containingAllOf(Object.values(PersonIndexes));
		});

		it('inserts document clones', (done) => {
			const collection = new Collection<PersonDocument>({
				documentsIdentity: DocumentIdentity.CLONE
			});

			collection.watch().subscribe((notification) => {
				try {
					expect(notification.action).to.be.eq(DocumentOperation.CREATED);
					expect(notification.documents.length).to.be.eq(collection.count);
					expect(notification.documents).to.not.containingAnyOf(PersonsRepo);

					return done();
				} catch (e) {
					return done(e);
				}
			});

			collection.insert(PersonsRepo);
		});

		it('emits notifications with inserted documents', (done) => {
			const collection = new Collection<PersonDocument>();

			collection.watch().subscribe((notification) => {
				try {
					expect(notification.action).to.be.eq(DocumentOperation.CREATED);
					expect(notification.documents.length).to.be.eq(collection.count);
					expect(notification.documents).to.be.containingAllOf(PersonsRepo);

					return done();
				} catch (e) {
					return done(e);
				}
			});

			collection.insert(PersonsRepo);
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

			function findSlowly(pk: NonNullable<IndexValue>): TimedExecutionResult<Array<PersonDocument>> {
				const query: Query<PersonDocument> = {
					$or: [{ [PRIMARY_KEY_INDEX]: pk }, { [PRIMARY_KEY_INDEX]: '' }] // it will never be an empty string
				};
				return chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
			}

			it('should return a single document when providing query and hint to primary index', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX]
				};
				const criteria: Partial<FindCriteria<PersonDocument>> = {
					index: {
						key: PRIMARY_KEY_INDEX,
						value: desired[PRIMARY_KEY_INDEX]
					}
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query, criteria);
				expect(measuredMatches.result).to.be.equalTo([desired]);

				const slowMeasuredMatches = findSlowly(desired[PRIMARY_KEY_INDEX]);
				expect(slowMeasuredMatches.result).to.be.equalTo([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it('should return a single document when providing query with primary key value (no hint)', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX]
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).to.be.equalTo([desired]);

				const slowMeasuredMatches = findSlowly(desired[PRIMARY_KEY_INDEX]);
				expect(slowMeasuredMatches.result).to.be.equalTo([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it(`should return a single document when providing query with primary key and ${MongooseOperators.EQUAL} operator (no hint)`, () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX]
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).to.be.equalTo([desired]);

				const slowMeasuredMatches = findSlowly(desired[PRIMARY_KEY_INDEX]);
				expect(slowMeasuredMatches.result).to.be.equalTo([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it(`should return a single document when providing query with primary key and ${MongooseOperators.IN} operator with single value in array (no hint)`, () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: {
						$in: [desired[PRIMARY_KEY_INDEX]]
					}
				};
				const measuredMatches = chrono.executionTime<any, Array<PersonDocument>>(suiteCollection.find, suiteCollection, query);
				expect(measuredMatches.result).to.be.equalTo([desired]);

				const slowMeasuredMatches = findSlowly(desired[PRIMARY_KEY_INDEX]);
				expect(slowMeasuredMatches.result).to.be.equalTo([desired]);

				expect(measuredMatches.time.milliseconds).to.be.lessThan(slowMeasuredMatches.time.milliseconds);
			});

			it(`should return a multiple documents when providing query with primary key and ${MongooseOperators.IN} operator with multiple value in array (no hint with index)`, () => {
				const desiredDocuments = uniqBy(
					array.filledWith(number.randomInt(10, 15), () => array.randomElement(suiteCollection.find())),
					PRIMARY_KEY_INDEX
				);

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: {
						$in: desiredDocuments.map((doc) => doc[PRIMARY_KEY_INDEX])
					}
				};
				const matches = suiteCollection.find(query, { multiple: true });

				expect(matches).to.be.ofSize(desiredDocuments.length);
				expect(matches).to.be.containingAllOf(desiredDocuments);
			});

			it('should not return document when providing query with primary key and another conditions that are not met by that single document (no hint)', () => {
				const desired = array.randomElement(suiteCollection.find());

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX],
					birthYear: {
						$ne: desired.birthYear
					}
				};
				const matches = suiteCollection.find(query, { multiple: true });

				expect(matches).to.be.ofSize(0);
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
				[PRIMARY_KEY_INDEX]: string.ofLength(10),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.ofLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.ofLength(5)
				},
				finance: {
					bank: {
						name: string.ofLength(5)
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

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX]
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
			expect(singleMatch).to.be.ofSize(1);
		});

		it('should find a single document matching the predicate', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PRIMARY_KEY_INDEX]: string.ofLength(10),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.ofLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.ofLength(5)
				},
				finance: {
					bank: {
						name: string.ofLength(5)
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
				return person[PRIMARY_KEY_INDEX] === desired[PRIMARY_KEY_INDEX];
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
				[PRIMARY_KEY_INDEX]: string.ofLength(10),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.ofLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.ofLength(5)
				},
				finance: {
					bank: {
						name: string.ofLength(5)
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
				return person[PRIMARY_KEY_INDEX] === desired[PRIMARY_KEY_INDEX];
			}

			/** EXCLUDE */
			const excludeProjection: Projection<PersonDocument> = {
				type: ProjectionType.EXCLUDE,
				fields: ['birthYear', 'finance.transactions']
			};
			let matches = collection.find(predicate, { projection: excludeProjection });
			expect(matches.length).to.be.eq(1);

			expect(matches[0]).to.be.instanceOf(PersonDocument);
			expect(matches[0] === desired).to.be.eq(false); // this is a clone
			expect(matches[0]).to.not.be.deep.eq(desired); // created new elem with projection

			expect(matches[0][PRIMARY_KEY_INDEX]).to.be.eq(desired[PRIMARY_KEY_INDEX]); // just to be confident it found what we need

			for (const excludedProp of excludeProjection.fields) {
				expect(dotProp.get(matches[0], excludedProp)).to.be.eq(undefined);
			}

			/** INCLUDE */
			const includeProjection: Projection<PersonDocument> = {
				type: ProjectionType.INCLUDE,
				fields: [PRIMARY_KEY_INDEX, 'address.countryCode']
			};
			matches = collection.find(predicate, { projection: includeProjection });
			expect(matches.length).to.be.eq(1);

			expect(matches[0]).to.be.instanceOf(PersonDocument);
			expect(matches[0] === desired).to.be.eq(false); // this is a clone
			expect(matches[0]).to.not.be.deep.eq(desired); // created new elem with projection

			expect(Object.keys(matches[0]).length).to.be.eq(includeProjection.fields.length); // only included fields

			for (const includedProp of includeProjection.fields) {
				expect(dotProp.get(matches[0], includedProp)).to.be.eq(dotProp.get(desired, includedProp));
			}
		});

		it('should find a single document and sort it', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const desired = array.randomElement(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX]
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				sort: {
					birthYear: SortDirection.ASCENDING
				}
			};

			const matches = collection.find(query, criteria);
			expect(matches).to.be.equalTo([desired]);
		});

		it('should find multiple documents and sort them by a single property (ASCENDING)', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				birthYear: {
					$gte: 1990,
					$lt: 2000
				},
				// @ts-ignore
				'address.countryCode': {
					$in: ['EN', 'RU', 'DE']
				}
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				sort: {
					birthYear: SortDirection.ASCENDING
				}
			};

			const matches = collection.find(query, criteria);

			function filter(doc: PersonDocument): boolean {
				const birthYearRange = Array.from(range(dotProp.get(query.birthYear! as ObjMap, '$gte'), dotProp.get(query.birthYear! as ObjMap, '$lt')));
				const isInBirthYearRange = birthYearRange.includes(doc.birthYear);

				const countryCode = dotProp.get(doc, 'address.countryCode');
				// @ts-ignore
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

			const query: QueryConditions<PersonDocument> = {
				birthYear: {
					$gte: 1990,
					$lt: 1995
				}
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				sort: {
					firstName: SortDirection.DESCENDING
				}
			};

			const matches = collection.find(query, criteria);
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
					[PRIMARY_KEY_INDEX]: string.ofLength(10),
					birthYear: 1995,
					firstName: 'John',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.ofLength(5)
					},
					finance: {
						bank: {
							name: string.ofLength(5)
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
					[PRIMARY_KEY_INDEX]: string.ofLength(10),
					birthYear: 1999,
					firstName: 'John',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.ofLength(5)
					},
					finance: {
						bank: {
							name: string.ofLength(5)
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
					[PRIMARY_KEY_INDEX]: string.ofLength(10),
					birthYear: 1992,
					firstName: 'Clint',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.ofLength(5)
					},
					finance: {
						bank: {
							name: string.ofLength(5)
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
					[PRIMARY_KEY_INDEX]: string.ofLength(10),
					birthYear: 2000,
					firstName: 'Easter',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.ofLength(5)
					},
					finance: {
						bank: {
							name: string.ofLength(5)
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

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$in: toBeRetrievedLater.map((person) => person[PRIMARY_KEY_INDEX])
				}
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				sort: {
					firstName: SortDirection.DESCENDING,
					birthYear: SortDirection.ASCENDING
				}
			};

			const matches = collection.find(query, criteria);

			expect(matches.length).to.be.eq(toBeRetrievedLater.length);
			expect(matches).to.containingAllOf(toBeRetrievedLater);

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

			const criteria: Partial<FindCriteria<PersonDocument>> = {
				index: {
					key: PersonIndexes.I_BIRTH_YEAR
				},
				sort: {
					[PersonIndexes.I_BIRTH_YEAR]: SortDirection.ASCENDING
				}
			};
			const matches = collection.find(null, criteria);
			const crossCheck = orderBy(PersonsRepo, [PersonIndexes.I_BIRTH_YEAR], ['asc']);

			expect(matches).to.be.ofSize(crossCheck.length);
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
				dotProp.set(document, array.randomElement(sortFields), array.randomElement(nullables));
				collection.insert(document);
				documents[i] = document;
			}

			const criteria: Partial<FindCriteria<PersonDocument>> = {
				sort: {
					birthYear: SortDirection.DESCENDING,
					firstName: SortDirection.ASCENDING
				}
			};
			const matches = collection.find(null, criteria);
			const crossCheck = orderBy(documents, sortFields, ['desc', 'asc']);

			expect(matches).to.be.ofSize(crossCheck.length);
			for (let i = 0; i < crossCheck.length; i++) {
				expect(matches[i]).to.be.eq(crossCheck[i]);
			}
		});

		it('should throw when no sorting fields are given', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const criteria: Partial<FindCriteria<PersonDocument>> = {
				sort: {}
			};

			const throwable = () => collection.find(null, criteria);
			expect(throwable).to.throw('At leas one sorting field needs to be present. Found: 0.');
		});

		it('should find multiple documents using specified index', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				// @ts-ignore
				[PersonIndexes.II_COUNTRY_CODE]: {
					$in: array.filledWith(5, () => dotProp.get(array.randomElement(PersonsRepo), PersonIndexes.II_COUNTRY_CODE))
				}
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				index: {
					key: PersonIndexes.II_COUNTRY_CODE
				}
			};

			const matches = collection.find(query, criteria);
			expect(matches.length).to.be.gt(0);

			const crossCheck = PersonsRepo.filter((person) => {
				// @ts-ignore
				const expected = query[PersonIndexes.II_COUNTRY_CODE].$in as Array<string>;
				const actual = dotProp.get(person, PersonIndexes.II_COUNTRY_CODE) as string;
				return expected.includes(actual);
			});
			expect(matches).to.be.containingAllOf(crossCheck);

			for (const match of matches) {
				const actual = dotProp.get(match, PersonIndexes.II_COUNTRY_CODE) as string;
				// @ts-ignore
				const expected = query[PersonIndexes.II_COUNTRY_CODE].$in as Array<string>;
				expect(actual).to.be.oneOf(expected);
			}
		});

		it("should find multiple documents using specified index and it's value", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				index: {
					key: PersonIndexes.II_COUNTRY_CODE,
					value: dotProp.get(array.randomElement(PersonsRepo), PersonIndexes.II_COUNTRY_CODE)
				}
			};

			const matches = collection.find(null, criteria);
			expect(matches.length).to.be.gt(0);

			const crossCheck = PersonsRepo.filter((person) => dotProp.get(person, PersonIndexes.II_COUNTRY_CODE) === criteria.index!.value);
			expect(matches).to.be.containingAllOf(crossCheck);

			for (const match of matches) {
				const actual = dotProp.get(match, PersonIndexes.II_COUNTRY_CODE) as string;
				const expected = criteria.index!.value;
				expect(actual).to.be.eq(expected);
			}
		});

		it('should find a single document and return a clone of it', () => {
			const collection = new Collection<PersonDocument>({
				documentsIdentity: DocumentIdentity.CLONE
			});
			collection.insert(PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PRIMARY_KEY_INDEX]: string.ofLength(10),
				birthYear: number.randomInt(minBirthYear, maxBirthYear),
				firstName: string.ofLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.ofLength(5)
				},
				finance: {
					bank: {
						name: string.ofLength(5)
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

			const query: QueryConditions<PersonDocument> = {
				birthYear: {
					$gte: minBirthYear,
					$lte: maxBirthYear
				},
				// @ts-ignore
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
			expect(matches[0][PRIMARY_KEY_INDEX]).to.be.eq(desired[PRIMARY_KEY_INDEX]);
		});

		it("should not find documents using specified index and it's value, bot not matching on query", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				// @ts-ignore
				[PersonIndexes.II_COUNTRY_CODE]: string.ofLength(5, /[0-9]/)
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				index: {
					key: PersonIndexes.II_COUNTRY_CODE,
					value: dotProp.get(array.randomElement(PersonsRepo), PersonIndexes.II_COUNTRY_CODE)
				}
			};

			const matches = collection.find(query, criteria);
			expect(matches.length).to.be.eq(0);
		});

		it("should not find documents when query don't match anything", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [PersonIndexes.II_COUNTRY_CODE]
			});
			collection.insert(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: string.ofLength(5, /[0-9]/)
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: false,
				index: { key: PersonIndexes.II_COUNTRY_CODE },
				sort: { birthYear: SortDirection.ASCENDING },
				projection: {
					fields: ['finance'],
					type: ProjectionType.EXCLUDE
				}
			};

			const matches = collection.find(query, criteria);
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

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replaced[PRIMARY_KEY_INDEX]
			};
			const oldDoc = collection.replace(queryForOldDoc, replacement);

			expect(collection.count).to.be.eq(PersonsRepo.length); // same number of elements remained
			expect(oldDoc).to.be.equalTo([replaced]); // returned old doc
			expect(collection.find(queryForOldDoc)).to.be.equalTo([]); // removed old doc

			const queryForNewDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replacement[PRIMARY_KEY_INDEX]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).to.be.equalTo([replacement]); // replaced with new doc
		});

		it('should replace multiple documents with a single one', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const docsToBeReplaced = randomDocuments();
			const replacement = generatePersonDocument();

			const queryForOldDocs: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$in: docsToBeReplaced.map((doc) => doc[PRIMARY_KEY_INDEX])
				}
			};
			const criteria: Partial<ReplaceCriteria<PersonDocument>> = {
				multiple: true,
				index: { key: PRIMARY_KEY_INDEX }
			};
			const oldDocs = collection.replace(queryForOldDocs, replacement, criteria);

			expect(collection.count).to.be.eq(PersonsRepo.length - docsToBeReplaced.length + 1); // number of elements dropped
			expect(oldDocs.length).to.be.eq(docsToBeReplaced.length); // returned all old docs ...
			expect(oldDocs).to.be.containingAllOf(docsToBeReplaced); // ... in their exemplars
			expect(collection.find(queryForOldDocs)).to.be.equalTo([]); // ... and removed all of them

			const queryForNewDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replacement[PRIMARY_KEY_INDEX]
			};
			const newDoc = collection.find(queryForNewDoc, criteria);

			expect(newDoc).to.be.equalTo([replacement]); // replaced with new doc
		});

		it('should upsert replacement if document for given query was not found', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const replaced = generatePersonDocument(); // it's not present
			const replacement = generatePersonDocument();

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replaced[PRIMARY_KEY_INDEX]
			};
			const criteria: Partial<ReplaceCriteria<PersonDocument>> = {
				upsert: true
			};
			const oldDoc = collection.replace(queryForOldDoc, replacement, criteria);

			expect(collection.count).to.be.eq(PersonsRepo.length + 1); // there was an upsert
			expect(oldDoc).to.be.equalTo([]); // no old docs found
			expect(collection.find(queryForOldDoc)).to.be.equalTo([]); // pedantic check that no old docs are present

			const queryForNewDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replacement[PRIMARY_KEY_INDEX]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).to.be.equalTo([replacement]); // upserted the replacement
		});

		it('when search criteria says not to upsert should not upsert replacement if document for given query was not found', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const replaced = generatePersonDocument(); // it's not present
			const replacement = generatePersonDocument();

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replaced[PRIMARY_KEY_INDEX]
			};
			const oldDoc = collection.replace(queryForOldDoc, replacement);

			expect(collection.count).to.be.eq(PersonsRepo.length); // old doc not found, so replacement (i.e. upsert) didn't took place
			expect(oldDoc).to.be.equalTo([]); // no old docs found

			const queryForNewDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replacement[PRIMARY_KEY_INDEX]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).to.be.equalTo([]); // replacement was not upserted
		});

		it('should clone replacement when document identity is set to clone', () => {
			const collection = new Collection<PersonDocument>({
				documentsIdentity: DocumentIdentity.CLONE
			});
			collection.insert(PersonsRepo);

			const replaced = array.randomElement(PersonsRepo);
			const replacement = generatePersonDocument();

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replaced[PRIMARY_KEY_INDEX]
			};
			collection.replace(queryForOldDoc, replacement);

			const queryForNewDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replacement[PRIMARY_KEY_INDEX]
			};
			const newDoc = collection.find(queryForNewDoc);

			expect(newDoc).to.not.be.equalTo([replacement]); // new doc is a clone of replacement ...
			expect(newDoc).to.be.ofSize(1);
			expect(newDoc[0][PRIMARY_KEY_INDEX]).to.be.eq(replacement[PRIMARY_KEY_INDEX]); // ... although they have the same values
		});

		it('should notify when old document was removed and replaced', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const replaced = array.randomElement(PersonsRepo);
			const replacement = generatePersonDocument();

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: replaced[PRIMARY_KEY_INDEX]
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement);

			expect(notifications).to.be.ofSize(2); // delete + insert

			expect(notifications[0].action).to.be.eq(DocumentOperation.DELETED);
			expect(notifications[0].documents).to.be.equalTo([replaced]);
			expect(notifications[0].documents).to.be.equalTo(oldDocs); // they are same references

			expect(notifications[1].action).to.be.eq(DocumentOperation.CREATED);
			expect(notifications[1].documents).to.be.equalTo([replacement]);
		});

		it('should notify when replacement was upserted', () => {
			const collection = new Collection<PersonDocument>();
			expect(collection.count).to.be.eq(0);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const replacement = generatePersonDocument();

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: string.ofLength(2)
			};
			const criteria: Partial<ReplaceCriteria<PersonDocument>> = {
				upsert: true
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement, criteria);
			expect(oldDocs).to.be.ofSize(0);
			expect(collection.count).to.be.eq(1);

			expect(notifications).to.be.ofSize(1); // insert

			expect(notifications[0].action).to.be.eq(DocumentOperation.CREATED);
			expect(notifications[0].documents).to.be.equalTo([replacement]);
		});

		it('should not notify when replacement was not upserted', () => {
			const collection = new Collection<PersonDocument>();
			expect(collection.count).to.be.eq(0);

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			const replacement = generatePersonDocument();

			const queryForOldDoc: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: string.ofLength(2)
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement);
			expect(oldDocs).to.be.ofSize(0);
			expect(collection.count).to.be.eq(0);

			expect(notifications).to.be.ofSize(0);
		});
	});

	describe(`${Collection.prototype.update.name} spec`, () => {
		describe('update validation spec', () => {
			it('should validate update by default', () => {
				const collection = new Collection<PersonDocument>();
				collection.insert(PersonsRepo);

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: randomDocuments(1, 1)[0][PRIMARY_KEY_INDEX]
				};
				const update = {
					$fff: {
						$bb: string.ofLength(5, /[A-Za-z]/)
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
					[PRIMARY_KEY_INDEX]: randomDocuments(1, 1)[0][PRIMARY_KEY_INDEX]
				};
				const update = {
					$fff: {
						$bb: string.ofLength(5, /[A-Za-z]/)
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
					[PRIMARY_KEY_INDEX]: randomDocuments(1, 1)[0][PRIMARY_KEY_INDEX]
				};
				const update = {
					$fff: {
						$bb: string.ofLength(5, /[A-Za-z]/)
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
				[PRIMARY_KEY_INDEX]: toBeUpdated[PRIMARY_KEY_INDEX]
			};
			const update = {
				$set: {
					firstName: string.ofLength(5, /[A-Za-z]/)
				}
			};

			const originalSnapshot = collection.find(query)[0].clone();

			const oldDoc = collection.update(query, update);
			expect(collection.count).to.be.eq(PersonsRepo.length); // there was just an update

			expect(oldDoc).to.be.ofSize(1);
			expect(oldDoc[0]).not.to.be.equal(toBeUpdated); // it returned a clone of old document...
			expect(oldDoc[0]).not.to.be.deep.equal(toBeUpdated); // ...with different values
			expect(oldDoc[0]).to.be.deep.equal(originalSnapshot); // just to be sure it returned old value

			const updatedDoc = collection.find(query);

			expect(updatedDoc).to.be.ofSize(1);
			expect(updatedDoc[0][PRIMARY_KEY_INDEX]).to.be.eq(toBeUpdated[PRIMARY_KEY_INDEX]);

			for (const [prop, value] of Object.entries(update.$set)) {
				expect(dotProp.get(updatedDoc[0], prop)).to.be.deep.eq(value); // ...with updated properties
			}
		});

		it('should update multiple documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(2, 5));

			const query: Query<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$in: toBeUpdated.map((doc) => doc[PRIMARY_KEY_INDEX])
				}
			};
			const criteria: Partial<UpdateCriteria<PersonDocument>> = {
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

			const originalSnapshots = ordered(collection.find(query, criteria).map((doc) => doc.clone()));
			expect(originalSnapshots).to.be.ofSize(toBeUpdated.length);

			const oldDocs = ordered(collection.update(query, update, criteria));
			expect(collection.count).to.be.eq(PersonsRepo.length); // there was just an update

			// returned originals ...
			for (let i = 0; i < originalSnapshots.length; i++) {
				expect(oldDocs[i]).to.be.deep.equal(originalSnapshots[i]); // they are both clones
			}
			expect(oldDocs).not.to.be.equalTo(toBeUpdated); // ... and updated in the collection

			const updatedDocs = ordered(collection.find(query, criteria));

			expect(updatedDocs).to.be.equalTo(toBeUpdated); // returned updates
			for (let i = 0; i < updatedDocs.length; i++) {
				// removed property
				expect(dotProp.get(updatedDocs[i], 'firstName')).to.be.eq(undefined);
				// incremented property
				expect(updatedDocs[i].birthYear).to.be.eq(oldDocs[i].birthYear + 10);
				// renamed property
				expect(dotProp.get(updatedDocs[i], 'finance.bank.id')).to.be.eq(dotProp.get(oldDocs[i], 'finance.bank.name'));
				// additional elements
				expect(updatedDocs[i].finance.transactions).to.be.containingAllOf(update.$push['finance.transactions'].$each);
			}
		});

		it('should return updated documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = array.randomElement(PersonsRepo);

			const query: Query<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: toBeUpdated[PRIMARY_KEY_INDEX]
			};
			const criteria: Partial<UpdateCriteria<PersonDocument>> = {
				returnUpdates: true
			};
			const update = {
				$pop: {
					'finance.transactions': -1
				}
			};

			const originalSnapshot = collection.find(query)[0].clone();

			const updatedDocs = collection.update(query, update, criteria);
			expect(updatedDocs).to.be.ofSize(1);

			// returned the update ...
			expect(updatedDocs).not.to.be.eq(originalSnapshot);
			expect(updatedDocs).not.to.be.deep.eq(originalSnapshot);

			// ... with right values
			const updatedTx = orderBy(updatedDocs[0].finance.transactions, ['amount'], ['asc']);
			const slicedOriginalTx = orderBy(originalSnapshot.finance.transactions.slice(1), ['amount'], ['asc']);

			expect(updatedTx).to.be.ofSize(slicedOriginalTx.length);
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
				[PRIMARY_KEY_INDEX]: original[PRIMARY_KEY_INDEX]
			};
			const update = {
				$set: {
					[PRIMARY_KEY_INDEX]: string.ofLength(5)
				}
			};

			expect(() => collection.update(query, update)).to.throw(`Can't reindex primary index '${PRIMARY_KEY_INDEX}' value.`);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const nonExistentDoc = collection.find(query);
			expect(nonExistentDoc).to.be.ofSize(0);
		});

		it('should update indexes when they values are changed', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: Object.values(PersonIndexes)
			});
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeUpdated = ordered(randomDocuments(20, 30));

			const query: Query<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$in: toBeUpdated.map((doc) => doc[PRIMARY_KEY_INDEX])
				}
			};
			const criteria: Partial<UpdateCriteria<PersonDocument>> = {
				multiple: true,
				returnUpdates: true
			};
			const update = {
				$set: {
					[PersonIndexes.I_BIRTH_YEAR]: number.randomInt(2010, 2020),
					[PersonIndexes.II_COUNTRY_CODE]: string.ofLength(3, /[A-Z]/),
					[PersonIndexes.III_BANK_NAME]: string.ofLength(5, /[a-zA-Z]/)
				}
			};

			assertFoundByIndexes(collection, toBeUpdated); // finds by old values of indexes

			const updatedDocs = collection.update(query, update, criteria);
			expect(updatedDocs).to.be.ofSize(toBeUpdated.length);

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
					[PRIMARY_KEY_INDEX]: toUpdate[PRIMARY_KEY_INDEX]
				};
				const update = {
					$unset: {
						[updatedIdx]: ''
					},
					$set: {
						[updatedIdx]: IndexValueGenerators.get(updatedIdx)!()
					}
				};

				expect(collection.update(query, update)).to.be.ofSize(1);

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
					[PRIMARY_KEY_INDEX]: toUpdate[PRIMARY_KEY_INDEX]
				};
				const update = {
					$set: {
						[nullifiedIndex]: array.randomElement(nullables)
					}
				};

				expect(collection.update(query, update)).to.be.ofSize(1);

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
					[PRIMARY_KEY_INDEX]: toUpdate[PRIMARY_KEY_INDEX]
				};
				const update = {
					$unset: {
						[nullifiedIndex]: ''
					}
				};

				expect(collection.update(query, update)).to.be.ofSize(1);

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
				const newName = string.ofLength(5, /[a-zA-z]/);

				const query: Query<PersonDocument> = {
					[PRIMARY_KEY_INDEX]: toUpdate[PRIMARY_KEY_INDEX]
				};
				const update = {
					$rename: {
						[renamedIndex]: newName
					}
				};

				expect(collection.update(query, update)).to.be.ofSize(1);

				const nonIndexed = [renamedIndex];
				const indexed = difference(indexNames, nonIndexed);
				assertFoundByIndexes(collection, toUpdate, indexed, nonIndexed);

				const bringNameBackUpdate = {
					$unset: {
						[newName]: ''
					},
					$set: {
						[renamedIndex]: dotProp.get(toUpdate, newName)
					}
				};
				expect(collection.update(query, bringNameBackUpdate)).to.be.ofSize(1);

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
					[PRIMARY_KEY_INDEX]: toUpdate[PRIMARY_KEY_INDEX]
				};
				const update = {
					$set: {
						[nullifiedIndex]: array.randomElement(nullables)
					}
				};

				expect(collection.update(query, update)).to.be.ofSize(1);

				const nonIndexed = [nullifiedIndex];
				const indexed = difference(indexNames, nonIndexed);
				assertFoundByIndexes(collection, toUpdate, indexed, nonIndexed);

				const createIndexBackUpdate = {
					$set: {
						[nullifiedIndex]: IndexValueGenerators.get(nullifiedIndex)!()
					}
				};

				expect(collection.update(query, createIndexBackUpdate)).to.be.ofSize(1);
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
					[PRIMARY_KEY_INDEX]: toUpdate[PRIMARY_KEY_INDEX]
				};
				const update = {
					$inc: {
						[PersonIndexes.I_BIRTH_YEAR]: 10
					},
					$set: {
						[PersonIndexes.I_BIRTH_YEAR]: dotProp.get(toUpdate, PersonIndexes.I_BIRTH_YEAR)
					}
				};

				const throwable = () => collection.update(query, update);
				expect(throwable).to.throw(`New and old values for index 'birthYear' are the same: ${dotProp.get(toUpdate, PersonIndexes.I_BIRTH_YEAR)}.`);

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
				[PRIMARY_KEY_INDEX]: toBeUpdated[PRIMARY_KEY_INDEX]
			};
			const update = {
				$set: {
					firstName: string.ofLength(5, /[A-Za-z]/)
				}
			};
			const criteria: Partial<UpdateCriteria<PersonDocument>> = {
				returnUpdates: true
			};
			const updatedDocs = collection.update(query, update, criteria);
			expect(updatedDocs).to.be.ofSize(1);

			expect(notifications).to.be.ofSize(1);
			expect(notifications[0].action).to.be.eq(DocumentOperation.UPDATED);
			expect(notifications[0].documents).to.be.equalTo(updatedDocs);
		});
	});

	describe(`${Collection.prototype.delete.name} spec`, () => {
		it('should delete document by id', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeDeleted = array.randomElement(PersonsRepo);
			const query: Query<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: toBeDeleted[PRIMARY_KEY_INDEX]
			};

			const deleted = collection.delete(query);
			expect(collection.count).to.be.eq(PersonsRepo.length - 1); // it was removed
			expect(deleted).to.be.equalTo([toBeDeleted]); // the right one

			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.be.ofSize(0);
		});

		it('should delete multiple documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const toBeDeleted = randomDocuments(10, 15);
			const query: Query<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$in: toBeDeleted.map((doc) => doc[PRIMARY_KEY_INDEX])
				}
			};

			const deleted = collection.delete(query);
			expect(collection.count).to.be.eq(PersonsRepo.length - toBeDeleted.length); // it was removed
			expect(deleted).to.be.ofSize(toBeDeleted.length);
			expect(deleted).to.be.containingAllOf(toBeDeleted); // the right ones

			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.be.ofSize(0);
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
				[PRIMARY_KEY_INDEX]: {
					$in: toBeDeleted.map((doc) => doc[PRIMARY_KEY_INDEX])
				}
			};
			const deleted = collection.delete(query);
			expect(deleted).to.be.ofSize(toBeDeleted.length);
			const notFoundDoc = collection.find(query);
			expect(notFoundDoc).to.be.ofSize(0);

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
				[PRIMARY_KEY_INDEX]: toBeDeleted[PRIMARY_KEY_INDEX]
			};
			const deleted = collection.delete(query);
			expect(deleted).to.be.equalTo([toBeDeleted]); // the right one

			expect(notifications).to.be.ofSize(1);
			expect(notifications[0].action).to.be.eq(DocumentOperation.DELETED);
			expect(notifications[0].documents).to.be.equalTo(deleted);
		});
	});

	describe(`${Collection.prototype.clear.name} spec`, () => {
		it('clears all documents', () => {
			const collection = new Collection<PersonDocument>();

			collection.insert(PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			collection.clear();
			expect(collection.count).to.be.eq(0);

			expect(collection.find()).to.be.equalTo([]);
		});

		it('notifies about clearing', () => {
			const collection = new Collection<PersonDocument>();

			const notifications = new Array<DocumentNotification<PersonDocument>>();
			collection.watch().subscribe((notification) => notifications.push(notification));

			collection.clear();
			expect(notifications).to.be.ofSize(1);
			expect(notifications[0].action).to.be.eq(DocumentOperation.CLEARED);
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
					// eslint-disable-next-line no-console
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
					// eslint-disable-next-line no-console
					console.error(err);
				},
				complete() {
					completions += 1;
				}
			});

			collection.drop();

			expect(notifications).to.be.ofSize(2);
			for (const notification of notifications) {
				expect(notification.action).to.be.eq(DocumentOperation.CLEARED);
				expect(notification.documents).to.be.eq(null);
			}

			expect(completions).to.be.eq(2);
		});
	});

	describe(`${Collection.prototype.map.name} spec`, () => {
		it('should map all documents', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(PersonsRepo);

			const primaryKeys = collection.map((doc) => doc[PRIMARY_KEY_INDEX]);
			const primaryKeysCrossCheck = PersonsRepo.map((person) => person[PRIMARY_KEY_INDEX]);
			expect(primaryKeys).to.be.ofSize(PersonsRepo.length);
			expect(primaryKeysCrossCheck).to.be.ofSize(PersonsRepo.length);
			expect(primaryKeys).to.be.containingAllOf(primaryKeysCrossCheck);
		});

		it('should map documents from index', () => {
			const indexNames = $enum(PersonIndexes).getValues();
			const collection = new Collection<PersonDocument>({
				indexKeys: indexNames
			});
			collection.insert(PersonsRepo);

			const indexName = array.randomElement(indexNames);
			const indexValue = dotProp.get(randomDocuments(1, 1)[0], indexName) as IndexValue;
			const criteria: IndexCriteria<PersonDocument> = {
				index: {
					key: indexName,
					value: indexValue
				}
			};
			const primaryKeys = collection.map((doc) => doc[PRIMARY_KEY_INDEX], criteria);

			const primaryKeysCrossCheck = PersonsRepo.filter((person) => dotProp.get(person, indexName) === indexValue).map(
				(person) => person[PRIMARY_KEY_INDEX]
			);

			expect(primaryKeys).to.be.ofSize(primaryKeysCrossCheck.length);
			expect(primaryKeys).to.be.containingAllOf(primaryKeysCrossCheck);
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
				const criteria: Partial<FindCriteria<PersonDocument>> = {
					index: { key: droppedIndex }
				};
				const throwable = () => collection.find(null, criteria);
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
				const criteria: Partial<FindCriteria<PersonDocument>> = {
					index: { key: droppedIndex }
				};
				const throwable = () => collection.find(null, criteria);
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
				expect(PersonsRepo).to.be.containing(document);
				iterations += 1;
			}
			expect(iterations).to.be.eq(PersonsRepo.length);
		});
	});
});
