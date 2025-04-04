import { faker } from '@faker-js/faker';
import { randomInt } from 'node:crypto';
import type { Person, Transaction } from './typings.js';

function generateTestData(amount: number): Promise<Person[]> {
	return Promise.resolve(
		Array.from(
			{ length: amount },
			(): Person => ({
				id: faker.string.uuid(),
				birthYear: faker.date.birthdate({ mode: 'year', min: 1990, max: 2025 }).getUTCFullYear(),
				firstName: faker.person.firstName(),
				address: {
					city: faker.location.city(),
					countryCode: faker.location.countryCode()
				},
				finance: {
					bank: {
						name: faker.finance.accountName()
					},
					transactions: Array.from(
						{ length: randomInt(5, 10) },
						(): Transaction => ({
							amount: faker.finance.amount(),
							transactionType: faker.finance.transactionType(),
							currencySymbol: faker.finance.currencySymbol()
						})
					)
				},
				visitedCountries: Array.from({ length: randomInt(5, 10) }, () => faker.location.countryCode())
			})
		)
	);
}

export { generateTestData };
