import { faker } from '@faker-js/faker';
import { randomInt } from 'node:crypto';
import { IndexValueGenerators, PersonIndexes } from './indexes.js';
import type { Person, Transaction } from './typings.js';

function generateTransaction(): Transaction {
	return {
		amount: faker.finance.amount(),
		transactionType: faker.finance.transactionType(),
		currencySymbol: faker.finance.currencySymbol()
	};
}

function generatePerson(): Person {
	return {
		id: faker.string.uuid(),
		birthYear: IndexValueGenerators[PersonIndexes.I_BIRTH_YEAR](),
		firstName: faker.person.firstName(),
		address: {
			city: faker.location.city(),
			countryCode: IndexValueGenerators[PersonIndexes.II_COUNTRY_CODE]()
		},
		finance: {
			bank: {
				name: IndexValueGenerators[PersonIndexes.III_BANK_NAME]()
			},
			transactions: Array.from({ length: randomInt(5, 10) }, generateTransaction)
		},
		visitedCountries: Array.from({ length: randomInt(5, 10) }, IndexValueGenerators[PersonIndexes.II_COUNTRY_CODE])
	};
}

function generatePersons(amount: number): Person[] {
	return Array.from({ length: amount }, generatePerson);
}

export { generatePersons, generatePerson, generateTransaction };
