import { string, number } from '@thermopylae/lib.utils';
import deepFreeze from 'deep-freeze';
import { mocker } from 'mocker-data-generator';
import { Person, Transaction } from './typings';

const TRANSACTION_SCHEMA_NAME = 'transaction';
const PERSON_SCHEMA_NAME = 'person';

const TransactionGenerationSchema = {
	transactionType: {
		faker: 'finance.transactionType'
	},
	amount: {
		function: () => string.random({ length: 3, allowedCharRegex: /[0-9]/ })
	},
	currencySymbol: {
		faker: 'finance.currencySymbol'
	}
};
const PersonGenerationSchema = {
	id: {
		faker: 'datatype.uuid'
	},
	firstName: {
		faker: 'name.firstName'
	},
	birthYear: {
		function: () => number.randomInt(1990, 2000)
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
					// @ts-ignore This is just fake data
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
deepFreeze(PersonGenerationSchema);

function generateTestData(amount: number): Promise<Array<Person>> {
	return mocker()
		.schema(TRANSACTION_SCHEMA_NAME, TransactionGenerationSchema, 10)
		.schema(PERSON_SCHEMA_NAME, PersonGenerationSchema, amount)
		.build()
		.then((data) => data[PERSON_SCHEMA_NAME]);
}

export { generateTestData };
