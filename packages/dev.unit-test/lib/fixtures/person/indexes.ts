import cryptoRandomString from 'crypto-random-string';
import deepFreeze from 'deep-freeze';
import { randomInt } from 'node:crypto';

enum PersonIndexes {
	I_BIRTH_YEAR = 'birthYear',
	II_COUNTRY_CODE = 'address.countryCode',
	III_BANK_NAME = 'finance.bank.name'
}

type IndexValueGenerator = () => string | number;

const IndexValueGenerators = new Map<PersonIndexes, IndexValueGenerator>([
	[PersonIndexes.I_BIRTH_YEAR, () => randomInt(2000, 2020)],
	[PersonIndexes.II_COUNTRY_CODE, () => cryptoRandomString({ length: 5 })],
	[PersonIndexes.III_BANK_NAME, () => cryptoRandomString({ length: 5 })]
]);
deepFreeze(IndexValueGenerators);

export { PersonIndexes, IndexValueGenerators };
export type { IndexValueGenerator };
