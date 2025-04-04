import { faker } from '@faker-js/faker';

enum PersonIndexes {
	I_BIRTH_YEAR = 'birthYear',
	II_COUNTRY_CODE = 'address.countryCode',
	III_BANK_NAME = 'finance.bank.name'
}

const IndexValueGenerators = Object.freeze({
	[PersonIndexes.I_BIRTH_YEAR]: () => faker.date.birthdate({ mode: 'year', min: 1990, max: 2025 }).getUTCFullYear(),
	[PersonIndexes.II_COUNTRY_CODE]: () => faker.location.countryCode(),
	[PersonIndexes.III_BANK_NAME]: () => faker.finance.accountName()
});

export { PersonIndexes, IndexValueGenerators };
