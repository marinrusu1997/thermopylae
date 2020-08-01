import { beforeEach, describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { Cloneable } from '@thermopylae/core.declarations';
import { array, number, object, string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
// @ts-ignore
import range from 'range-generator';
import dotProp from 'dot-prop';
import { Collection, DocumentIdentity, DocumentOperation, Projection, ProjectionType, QueryConditions } from '../lib/collections/collection';
import { Address, Finance, Indexes, Person, PersonJsonSchema, providePersonRepository } from './fixtures/persons-repo';
import { IndexValue, PRIMARY_KEY_INDEX } from '../lib/collections/indexed-store';
import { ErrorCodes } from '../lib/error';

const { expect } = chai;

class PersonDocument implements Person, Cloneable<PersonDocument> {
	public readonly id: NonNullable<IndexValue>;

	public firstName: string;

	public birthYear: number;

	public address: Address;

	public finance: Finance;

	public constructor(person: Person) {
		this.id = person[PRIMARY_KEY_INDEX]!;
		this.firstName = person.firstName;
		this.address = person.address;
		this.birthYear = person.birthYear;
		this.finance = person.finance;
	}

	public clone(): PersonDocument {
		return new PersonDocument(
			object.cloneDeep({
				[PRIMARY_KEY_INDEX]: this.id,
				firstName: this.firstName,
				birthYear: this.birthYear,
				address: this.address,
				finance: this.finance
			})
		);
	}
}

let PersonsRepo: Array<PersonDocument>;

function randomPerson(): Person {
	return PersonsRepo[number.generateRandomInt(0, PersonsRepo.length - 1)];
}

describe.only('Collection spec', function () {
	beforeEach(async () => {
		const persons = await providePersonRepository();
		PersonsRepo = persons.map((person) => new PersonDocument(person));
	});

	describe('insert spec', function () {
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

			const person = randomPerson();
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

	describe('find spec', function () {
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
					countryCode: array.random(countryCodes),
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
				}
			});

			collection.insert(desired);

			const query: QueryConditions<PersonDocument> = {
				birthYear: {
					$gte: minBirthYear,
					$lt: maxBirthYear
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

			for (const match of matches) {
				expect(match.birthYear).to.be.oneOf(Array.from(range(minBirthYear, maxBirthYear)));
				expect(match.address.countryCode).to.be.oneOf(countryCodes);
				expect(match.finance.transactions.some((tx) => tx.currencySymbol === transactionCurrency)).to.be.eq(true);
			}
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
					countryCode: array.random(countryCodes),
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
				}
			});

			collection.insert(desired);

			function predicate(person: PersonDocument): boolean {
				if (person.birthYear >= minBirthYear && person.birthYear <= maxBirthYear) {
					if (countryCodes.includes(person.address.countryCode)) {
						if (person.finance.transactions.some((tx) => tx.currencySymbol === transactionCurrency)) {
							return true;
						}
					}
				}
				return false;
			}

			const matches = collection.find(predicate);
			expect(matches.length).to.be.eq(1);

			for (const match of matches) {
				expect(match.birthYear).to.be.oneOf(Array.from(range(minBirthYear, maxBirthYear)));
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
					countryCode: array.random(countryCodes),
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
				}
			});

			collection.insert(desired);

			function predicate(person: PersonDocument): boolean {
				if (person.birthYear >= minBirthYear && person.birthYear <= maxBirthYear) {
					if (countryCodes.includes(person.address.countryCode)) {
						if (person.finance.transactions.some((tx) => tx.currencySymbol === transactionCurrency)) {
							return true;
						}
					}
				}
				return false;
			}

			/** EXCLUDE */
			const excludeProjection: Projection<PersonDocument> = {
				type: ProjectionType.EXCLUDE,
				fields: ['birthYear', 'finance.transactions']
			};
			let matches = collection.find(predicate, { projection: excludeProjection });
			expect(matches.length).to.be.eq(1);

			expect(matches[0]).to.be.instanceOf(PersonDocument);
			expect(dotProp.get(matches[0], 'birthYear')).to.be.eq(undefined);
			expect(dotProp.get(matches[0], 'finance.transactions')).to.be.eq(undefined);

			/** INCLUDE */
			const includeProjection: Projection<PersonDocument> = {
				type: ProjectionType.INCLUDE,
				fields: [PRIMARY_KEY_INDEX, 'address.countryCode']
			};
			matches = collection.find(predicate, { projection: includeProjection });
			expect(matches.length).to.be.eq(1);

			expect(matches[0]).to.be.instanceOf(PersonDocument);
			// FIXME
		});
	});
});
