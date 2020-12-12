import { describe, it } from 'mocha';
import { Person, PersonIndexes } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { number, string } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
import dotprop from 'dot-prop';
// @ts-ignore
import range from 'range-generator';
import { IndexedStore, IndexValue, PK_INDEX_NAME } from '../lib';
import { ErrorCodes } from '../lib/error';
import { expect, PersonsRepo } from './utils';

describe(`${IndexedStore.prototype.read.name} spec`, () => {
	it('reads records by their id', () => {
		const storage = new IndexedStore<Person>();
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		const positionGenerator = range(number.randomInt(0, PersonsRepo.length / 10), number.randomInt(PersonsRepo.length / 5, PersonsRepo.length / 2));

		for (const position of positionGenerator) {
			const desired = PersonsRepo[position];
			const records = storage.read(PK_INDEX_NAME, desired.id);

			expect(records.length).to.be.eq(1);
			expect(records).to.be.containing(desired);
		}
	});

	it('reads records by their index', () => {
		const indexes = Object.values(PersonIndexes);
		const storage = new IndexedStore<Person>({ indexes });
		storage.insert(PersonsRepo);
		expect(storage.size).to.be.eq(PersonsRepo.length);

		const positionGenerator = range(number.randomInt(0, PersonsRepo.length / 10), number.randomInt(PersonsRepo.length / 5, PersonsRepo.length / 2));

		for (const indexName of indexes) {
			for (const position of positionGenerator) {
				const desired = PersonsRepo[position];
				const records = storage.read(indexName, dotprop.get(desired, indexName) as IndexValue);
				const actual = records[records.indexOf(desired)];

				expect(actual).to.be.deep.eq(desired);
			}
		}
	});

	it('reads records from empty storage', () => {
		const storage = new IndexedStore<Person>();
		expect(storage.read(PK_INDEX_NAME, string.ofLength(5))).to.be.equalTo([]);
	});

	it('reads records from empty index', () => {
		const storage = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const person = { ...PersonsRepo[0] };
		dotprop.set(person, PersonIndexes.I_BIRTH_YEAR, null);
		storage.insert([person]);

		expect(storage.read(PK_INDEX_NAME, person.id)).to.be.equalTo([person]);
		expect(() => storage.read(PK_INDEX_NAME, person.birthYear))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
	});

	it('fails to read from invalid index', () => {
		const storage = new IndexedStore<Person>();
		expect(() => storage.read(string.ofLength(5), string.ofLength(5)))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
	});
});
