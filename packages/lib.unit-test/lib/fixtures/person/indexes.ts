import { number, string } from '@thermopylae/lib.utils';
import deepFreeze from 'deep-freeze';

enum PersonIndexes {
	I_BIRTH_YEAR = 'birthYear',
	II_COUNTRY_CODE = 'address.countryCode',
	III_BANK_NAME = 'finance.bank.name'
}

type IndexValueGenerator = () => string | number;

const IndexValueGenerators = new Map<PersonIndexes, IndexValueGenerator>([
	[PersonIndexes.I_BIRTH_YEAR, () => number.randomInt(2000, 2020)],
	[PersonIndexes.II_COUNTRY_CODE, () => string.ofLength(5)],
	[PersonIndexes.III_BANK_NAME, () => string.ofLength(5)]
]);
deepFreeze(IndexValueGenerators);

export { PersonIndexes, IndexValueGenerator, IndexValueGenerators };
