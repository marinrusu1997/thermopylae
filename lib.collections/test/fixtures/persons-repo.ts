import { number, object, string } from '@thermopylae/lib.utils';
import mocker from 'mocker-data-generator';
import deepfreeze from 'deep-freeze';
import { JSONSchema } from 'json-schema-typed';
import { IndexValue, Recordable } from '../../lib/collections/indexed-store';

interface Transaction {
	transactionType: string;
	amount: string;
	currencySymbol: string;
}

interface Address {
	countryCode: string;
	city: string;
}

interface Finance {
	bank: {
		name: string;
	};
	transactions: Array<Transaction>;
}

interface Person extends Recordable {
	firstName: string;
	birthYear: number;
	address: Address;
	finance: Finance;
	visitedCountries: Array<string>;
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
deepfreeze(IndexValueGenerators);

const TRANSACTION_SCHEMA_NAME = 'transaction';
const PERSON_SCHEMA_NAME = 'person';

const TransactionSchema = {
	transactionType: {
		faker: 'finance.transactionType'
	},
	amount: {
		function: () => string.generateStringOfLength(3, /[0-9]/)
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
	},
	visitedCountries: [
		{
			faker: 'address.countryCode',
			length: 5,
			fixedLength: false
		}
	]
};
deepfreeze(PersonSchema);

const PersonJsonSchema: JSONSchema = {
	$schema: 'http://json-schema.org/draft-07/schema',
	type: 'object',
	properties: {
		id: {
			type: 'string',
			minLength: 5,
			maxLength: 36
		},
		firstName: {
			type: 'string',
			maxLength: 50
		},
		birthYear: {
			type: 'integer',
			minimum: 1990,
			maximum: 2020
		},
		address: {
			type: 'object',
			properties: {
				countryCode: {
					type: 'string',
					minLength: 2,
					maxLength: 3
				},
				city: {
					type: 'string',
					minLength: 2
				}
			},
			required: ['countryCode', 'city'],
			additionalProperties: false
		},
		finance: {
			type: 'object',
			properties: {
				bank: {
					type: 'object',
					properties: {
						name: {
							type: 'string',
							minLength: 3
						}
					},
					required: ['name'],
					additionalProperties: false
				},
				transactions: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							transactionType: {
								type: 'string',
								minLength: 2
							},
							amount: {
								type: 'string'
							},
							currencySymbol: {
								type: 'string',
								minLength: 1
							}
						},
						required: ['transactionType', 'amount', 'currencySymbol'],
						additionalProperties: false
					}
				}
			},
			required: ['bank', 'transactions'],
			additionalProperties: false
		},
		visitedCountries: {
			type: 'array',
			items: {
				type: 'string',
				minLength: 2,
				maxLength: 3
			}
		}
	},
	required: ['id', 'firstName', 'birthYear', 'address', 'finance', 'visitedCountries'],
	additionalProperties: false
};
deepfreeze(PersonJsonSchema);

let PersonsRepo: Array<Person>;

function generateTestData(amount: number): Promise<Array<Person>> {
	return mocker()
		.schema(TRANSACTION_SCHEMA_NAME, TransactionSchema, 10)
		.schema(PERSON_SCHEMA_NAME, PersonSchema, amount)
		.build()
		.then((data) => data[PERSON_SCHEMA_NAME]);
}

async function providePersonRepository(): Promise<Array<Person>> {
	if (PersonsRepo == null) {
		PersonsRepo = await generateTestData(100);
	}
	return PersonsRepo.map((person) => object.cloneDeep(person));
}

export { Transaction, Address, Finance, Person, Indexes, providePersonRepository, IndexValueGenerators, PersonJsonSchema };
