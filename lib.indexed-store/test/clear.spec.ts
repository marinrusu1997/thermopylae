import { describe, it } from 'mocha';
import { Person, PersonIndexes } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { IndexedStore, PRIMARY_KEY_INDEX } from '../lib';
import { expect, PersonsRepo, randomPerson } from './utils';

describe(`${IndexedStore.prototype.clear.name} spec`, () => {
	it('clears no entries when storage is empty', () => {
		const store = new IndexedStore<Person>();
		expect(store.size).to.be.eq(0);

		store.clear();
		expect(store.size).to.be.eq(0);
	});

	it('clears all entries from storage', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);
		expect(store.size).to.be.eq(PersonsRepo.length);

		store.clear();
		expect(store.size).to.be.eq(0);

		const candidate = randomPerson();
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

		expect(store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!.find(predicate)).to.be.eq(undefined);
	});

	it('clears all entries but preserves indexes', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);
		expect(store.size).to.be.eq(PersonsRepo.length);

		store.clear();
		expect(store.size).to.be.eq(0);

		for (const indexName of indexes) {
			expect(store.readIndex(indexName)!.size).to.be.eq(0);
		}
	});
});
