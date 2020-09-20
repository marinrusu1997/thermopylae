import { beforeEach, describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { Cloneable, ObjMap, SortDirection } from '@thermopylae/core.declarations';
import { array, chrono, number, object, string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
// @ts-ignore
import range from 'range-generator';
import uniqBy from 'lodash.uniqby';
import dotProp from 'dot-prop';
import { TimedExecutionResult } from '@thermopylae/lib.utils/dist/chrono';
import {
	Collection,
	DocumentIdentity,
	DocumentNotification,
	DocumentOperation,
	FindCriteria,
	Projection,
	ProjectionType,
	Query,
	QueryConditions
} from '../lib/collections/collection';
import { Address, Finance, Indexes, Person, PersonJsonSchema, providePersonRepository } from './fixtures/persons-repo';
import { IndexValue, PRIMARY_KEY_INDEX } from '../lib/collections/indexed-store';
import { ErrorCodes } from '../lib/error';
import { MongooseOperators, ReplaceCriteria } from '../lib/collections/collection/typings';

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

function generatePersonDocument(): PersonDocument {
	return new PersonDocument({
		[PRIMARY_KEY_INDEX]: string.generateStringOfLength(20),
		firstName: string.generateStringOfLength(5),
		birthYear: number.generateRandomInt(1990, 2000),
		address: {
			countryCode: string.generateStringOfLength(2, /[A-Z]/),
			city: string.generateStringOfLength(5, /[A-Za-z]/)
		},
		finance: {
			bank: {
				name: string.generateStringOfLength(5, /[A-Za-z]/)
			},
			transactions: array.filledWith(number.generateRandomInt(0, 5), () => ({
				amount: string.generateStringOfLength(3, /[0-9]/),
				currencySymbol: string.generateStringOfLength(1, /\$/),
				transactionType: string.generateStringOfLength(5, /[A-Za-z]/)
			}))
		},
		visitedCountries: array.filledWith(number.generateRandomInt(0, 5), () => string.generateStringOfLength(2, /[A-Z]/))
	});
}

// eslint-disable-next-line mocha/no-setup-in-describe
describe.only(`${Collection.name} spec`, function () {
	beforeEach(async () => {
		const persons = await providePersonRepository();
		PersonsRepo = persons.map((person) => new PersonDocument(person));
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${Collection.prototype.insert.name} spec`, function () {
		it('inserts documents without validating them', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(...PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);
		});

		it('inserts documents and validates them with the given schema', () => {
			const collection = new Collection<PersonDocument>({
				schema: PersonJsonSchema
			});
			collection.insert(...PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const person = array.randomElement(PersonsRepo);
			// @ts-ignore
			delete person.birthYear;

			const throwable = () => collection.insert(new PersonDocument(person));
			expect(throwable).to.throw(Exception).haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
		});

		it('inserts documents and indexes them', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: Object.values(Indexes)
			});
			collection.insert(...PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);
			expect(collection.indexes).to.be.containingAllOf(Object.values(Indexes));
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

			collection.insert(...PersonsRepo);
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

			collection.insert(...PersonsRepo);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${Collection.prototype.find.name} spec`, function () {
		// eslint-disable-next-line mocha/no-setup-in-describe
		describe(`${Collection.prototype.find.name}ById spec`, function () {
			let suiteCollection: Collection<PersonDocument>;

			beforeEach(() => {
				suiteCollection = new Collection<PersonDocument>();
				const docsNo = number.generateRandomInt(5_000, 10_000);

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
					hint: {
						index: PRIMARY_KEY_INDEX,
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
					[PRIMARY_KEY_INDEX]: {
						$eq: desired[PRIMARY_KEY_INDEX]
					}
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
					array.filledWith(number.generateRandomInt(10, 15), () => array.randomElement(suiteCollection.find())),
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
					[PRIMARY_KEY_INDEX]: {
						$eq: desired[PRIMARY_KEY_INDEX]
					},
					birthYear: {
						$ne: desired.birthYear
					}
				};
				const matches = suiteCollection.find(query, { multiple: true });

				expect(matches).to.be.ofSize(0);
			});
		});

		it('should return all documents when query is not specified', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(...PersonsRepo);

			const matches = collection.find();
			expect(matches.length).to.be.eq(PersonsRepo.length);
		});

		it('should find a single document matching the query', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(...PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
				birthYear: number.generateRandomInt(minBirthYear, maxBirthYear),
				firstName: string.generateStringOfLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.generateStringOfLength(5)
				},
				finance: {
					bank: {
						name: string.generateStringOfLength(5)
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(countryCodes))
			});

			collection.insert(desired);

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: desired[PRIMARY_KEY_INDEX]
			};

			const matches = collection.find(query);
			expect(matches.length).to.be.eq(1);
			expect(matches[0]).to.be.deep.eq(desired);
		});

		it('should find a single document matching the predicate', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(...PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
				birthYear: number.generateRandomInt(minBirthYear, maxBirthYear),
				firstName: string.generateStringOfLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.generateStringOfLength(5)
				},
				finance: {
					bank: {
						name: string.generateStringOfLength(5)
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(countryCodes))
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
			collection.insert(...PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
				birthYear: number.generateRandomInt(minBirthYear, maxBirthYear),
				firstName: string.generateStringOfLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.generateStringOfLength(5)
				},
				finance: {
					bank: {
						name: string.generateStringOfLength(5)
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(countryCodes))
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
			collection.insert(...PersonsRepo);

			const desired = array.randomElement(PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$eq: desired[PRIMARY_KEY_INDEX]
				}
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
			collection.insert(...PersonsRepo);

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
			collection.insert(...PersonsRepo);

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
			collection.insert(...PersonsRepo);

			const toBeRetrievedLater = [
				new PersonDocument({
					[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
					birthYear: 1995,
					firstName: 'John',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.generateStringOfLength(5)
					},
					finance: {
						bank: {
							name: string.generateStringOfLength(5)
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(['EN', 'DE']))
				}),
				new PersonDocument({
					[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
					birthYear: 1999,
					firstName: 'John',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.generateStringOfLength(5)
					},
					finance: {
						bank: {
							name: string.generateStringOfLength(5)
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(['EN', 'DE']))
				}),
				new PersonDocument({
					[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
					birthYear: 1992,
					firstName: 'Clint',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.generateStringOfLength(5)
					},
					finance: {
						bank: {
							name: string.generateStringOfLength(5)
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(['EN', 'DE']))
				}),
				new PersonDocument({
					[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
					birthYear: 2000,
					firstName: 'Easter',
					address: {
						countryCode: array.randomElement(['EN', 'DE']),
						city: string.generateStringOfLength(5)
					},
					finance: {
						bank: {
							name: string.generateStringOfLength(5)
						},
						transactions: [
							{
								currencySymbol: '$',
								amount: '889.6',
								transactionType: 'transfer'
							}
						]
					},
					visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(['EN', 'DE']))
				})
			];
			collection.insert(...toBeRetrievedLater);

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

		it('should find multiple documents using specified index', () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [Indexes.II_COUNTRY_CODE]
			});
			collection.insert(...PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				// @ts-ignore
				[Indexes.II_COUNTRY_CODE]: {
					$in: array.filledWith(5, () => dotProp.get(array.randomElement(PersonsRepo), Indexes.II_COUNTRY_CODE))
				}
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				hint: {
					index: Indexes.II_COUNTRY_CODE
				}
			};

			const matches = collection.find(query, criteria);
			expect(matches.length).to.be.gt(0);

			const crossCheck = PersonsRepo.filter((person) => {
				// @ts-ignore
				const expected = query[Indexes.II_COUNTRY_CODE].$in as Array<string>;
				const actual = dotProp.get(person, Indexes.II_COUNTRY_CODE) as string;
				return expected.includes(actual);
			});
			expect(matches).to.be.containingAllOf(crossCheck);

			for (const match of matches) {
				const actual = dotProp.get(match, Indexes.II_COUNTRY_CODE) as string;
				// @ts-ignore
				const expected = query[Indexes.II_COUNTRY_CODE].$in as Array<string>;
				expect(actual).to.be.oneOf(expected);
			}
		});

		it("should find multiple documents using specified index and it's value", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [Indexes.II_COUNTRY_CODE]
			});
			collection.insert(...PersonsRepo);

			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				hint: {
					index: Indexes.II_COUNTRY_CODE,
					value: dotProp.get(array.randomElement(PersonsRepo), Indexes.II_COUNTRY_CODE)
				}
			};

			const matches = collection.find(null, criteria);
			expect(matches.length).to.be.gt(0);

			const crossCheck = PersonsRepo.filter((person) => dotProp.get(person, Indexes.II_COUNTRY_CODE) === criteria.hint!.value);
			expect(matches).to.be.containingAllOf(crossCheck);

			for (const match of matches) {
				const actual = dotProp.get(match, Indexes.II_COUNTRY_CODE) as string;
				const expected = criteria.hint!.value;
				expect(actual).to.be.eq(expected);
			}
		});

		it('should find a single document and return a clone of it', () => {
			const collection = new Collection<PersonDocument>({
				documentsIdentity: DocumentIdentity.CLONE
			});
			collection.insert(...PersonsRepo);

			const minBirthYear = 1990;
			const maxBirthYear = 1995;
			const countryCodes = ['DE', 'EN'];
			const transactionCurrency = '$';

			const desired = new PersonDocument({
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(10),
				birthYear: number.generateRandomInt(minBirthYear, maxBirthYear),
				firstName: string.generateStringOfLength(5),
				address: {
					countryCode: array.randomElement(countryCodes),
					city: string.generateStringOfLength(5)
				},
				finance: {
					bank: {
						name: string.generateStringOfLength(5)
					},
					transactions: [
						{
							currencySymbol: transactionCurrency,
							amount: '889.6',
							transactionType: 'transfer'
						}
					]
				},
				visitedCountries: array.filledWith(number.generateRandomInt(0, 5), array.randomElement(countryCodes))
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
				// only digits can be specified
				'finance.transactions[0].currencySymbol': {
					$eq: transactionCurrency
				}
			};

			const matches = collection.find(query);
			expect(matches.length).to.be.eq(1);

			expect(matches[0] === desired).to.be.eq(false); // this is a clone
			expect(matches[0][PRIMARY_KEY_INDEX]).to.be.eq(desired[PRIMARY_KEY_INDEX]);
		});

		it("should not find documents using specified index and it's value, bot not matching on query", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [Indexes.II_COUNTRY_CODE]
			});
			collection.insert(...PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				// @ts-ignore
				[Indexes.II_COUNTRY_CODE]: {
					$eq: string.generateStringOfLength(5, /[0-9]/)
				}
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: true,
				hint: {
					index: Indexes.II_COUNTRY_CODE,
					value: dotProp.get(array.randomElement(PersonsRepo), Indexes.II_COUNTRY_CODE)
				}
			};

			const matches = collection.find(query, criteria);
			expect(matches.length).to.be.eq(0);
		});

		it("should not find documents when query don't match anything", () => {
			const collection = new Collection<PersonDocument>({
				indexKeys: [Indexes.II_COUNTRY_CODE]
			});
			collection.insert(...PersonsRepo);

			const query: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(5, /[0-9]/)
			};
			const criteria: Partial<FindCriteria<PersonDocument>> = {
				multiple: false,
				hint: { index: Indexes.II_COUNTRY_CODE },
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

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${Collection.prototype.replace.name} spec`, function () {
		it('should replace a single document', () => {
			const collection = new Collection<PersonDocument>();
			collection.insert(...PersonsRepo);
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
			collection.insert(...PersonsRepo);
			expect(collection.count).to.be.eq(PersonsRepo.length);

			const docsToBeReplaced = uniqBy(
				array.filledWith(number.generateRandomInt(10, 15), () => array.randomElement(PersonsRepo)),
				PRIMARY_KEY_INDEX
			);
			const replacement = generatePersonDocument();

			const queryForOldDocs: QueryConditions<PersonDocument> = {
				[PRIMARY_KEY_INDEX]: {
					$in: docsToBeReplaced.map((doc) => doc[PRIMARY_KEY_INDEX])
				}
			};
			const criteria: Partial<ReplaceCriteria<PersonDocument>> = {
				multiple: true,
				hint: { index: PRIMARY_KEY_INDEX }
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
			collection.insert(...PersonsRepo);
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
			collection.insert(...PersonsRepo);
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
			collection.insert(...PersonsRepo);

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
			collection.insert(...PersonsRepo);

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
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(2)
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
				[PRIMARY_KEY_INDEX]: string.generateStringOfLength(2)
			};
			const oldDocs = collection.replace(queryForOldDoc, replacement);
			expect(oldDocs).to.be.ofSize(0);
			expect(collection.count).to.be.eq(0);

			expect(notifications).to.be.ofSize(0);
		});
	});
});
