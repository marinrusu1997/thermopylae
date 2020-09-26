import { describe, it } from 'mocha';
import { IndexValueGenerators, Person, PersonIndexes } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import dotprop from 'dot-prop';
import { Exception } from '@thermopylae/lib.exception';
import { Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { object, string } from '@thermopylae/lib.utils';
import { ErrorCodes } from '../lib/error';
import { IndexedStore, IndexValue, PRIMARY_KEY_INDEX } from '../lib';
import { expect, NOT_FOUND_IDX, PersonsRepo, randomPerson } from './utils';

describe(`${IndexedStore.prototype.remove.name} spec`, () => {
	it('should not delete record if index is empty', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });
		const originalSize = store.size;

		const candidate = randomPerson();
		const indexValue = dotprop.get(candidate, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

		expect(store.remove(PersonIndexes.I_BIRTH_YEAR, indexValue, predicate)).to.be.eq(undefined);
		expect(store.size).to.be.eq(originalSize);
	});

	it('should not delete record if it is not indexed', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const indexed = randomPerson();
		store.insert([indexed]);

		let candidate: Person;
		while ((candidate = randomPerson()) === indexed);

		dotprop.set(candidate, PersonIndexes.I_BIRTH_YEAR, null);
		store.insert([candidate]);

		const originalSize = store.size;
		expect(originalSize).to.be.eq(2);

		const unIndexedVal = dotprop.get(candidate, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

		expect(() => store.remove(PersonIndexes.I_BIRTH_YEAR, unIndexedVal, predicate))
			.to.throw(Exception)
			.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
		expect(store.size).to.be.eq(originalSize);
	});

	it("should not delete record if it doesn't exist under index value", () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const indexed = randomPerson();
		store.insert([indexed]);
		const originalSize = store.size;

		const nonExistentVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX];

		expect(store.remove(PersonIndexes.I_BIRTH_YEAR, nonExistentVal, predicate)).to.be.eq(undefined);
		expect(store.size).to.be.eq(originalSize);
	});

	it("should not delete record if it doesn't passed predicate", () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const indexed = randomPerson();
		store.insert([indexed]);
		const originalSize = store.size;

		const indexedVal = dotprop.get(indexed, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const predicate = () => false;

		expect(store.remove(PersonIndexes.I_BIRTH_YEAR, indexedVal, predicate)).to.be.eq(undefined);
		expect(store.size).to.be.eq(originalSize);
	});

	it('should delete entries from primary index', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);
		expect(store.size).to.be.eq(PersonsRepo.length);

		const candidate = randomPerson();
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

		const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX]);
		expect(store.size).to.be.eq(PersonsRepo.length - 1);
		expect(removed).to.be.deep.eq(candidate);

		for (const indexName of indexes) {
			const match = store.read(indexName, dotprop.get(candidate, indexName) as IndexValue)!.find(predicate);
			expect(match).to.be.eq(undefined);
		}
	});

	it('should remove entries from secondary indexes', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);

		expect(store.size).to.be.eq(PersonsRepo.length);

		const removedCandidates = new Set<Person>();

		function candidateForRemoval(): Person {
			let candidate: Person = randomPerson();
			while (removedCandidates.has(candidate)) {
				candidate = randomPerson();
			}
			return candidate;
		}

		function markAsRemoved(candidate: Person): void {
			removedCandidates.add(candidate);
		}

		function assertNotFoundOnAllIndexes(candidate: Person, predicate: UnaryPredicate<Person>): void {
			for (const indexName of indexes) {
				const match = store.read(indexName, dotprop.get(candidate, indexName) as IndexValue)!.find(predicate);
				expect(match).to.be.eq(undefined);
			}
		}

		for (let i = 0; i < indexes.length; i++) {
			const candidate = candidateForRemoval();
			const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
			const removed = store.remove(indexes[i], dotprop.get(candidate, indexes[i]) as IndexValue, predicate);

			expect(store.size).to.be.eq(PersonsRepo.length - i - 1);
			expect(removed).to.be.deep.eq(candidate);
			assertNotFoundOnAllIndexes(candidate, predicate);

			markAsRemoved(candidate);
		}
	});

	it('should be able to insert same record after it was deleted', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);
		expect(store.size).to.be.eq(PersonsRepo.length);

		const candidate = randomPerson();
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
		let match: Optional<Person>;

		const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!;
		expect(store.size).to.be.eq(PersonsRepo.length - 1);
		expect(removed).to.be.deep.eq(candidate);
		match = store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])!.find(predicate);
		expect(match).to.be.eq(undefined);

		store.insert([removed]);
		expect(store.size).to.be.eq(PersonsRepo.length);
		match = store.read(PRIMARY_KEY_INDEX, removed[PRIMARY_KEY_INDEX])!.find(predicate);
		expect(match).to.be.deep.eq(removed);
	});

	it('throw when predicate is not provided for secondary indexes', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });

		const throwable = () => store.remove(PersonIndexes.I_BIRTH_YEAR, string.ofLength(5));
		expect(throwable).to.throw(Exception).haveOwnProperty('code', ErrorCodes.REQUIRED);
	});

	it('should remove record that was not indexed for one of the indexes', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);

		const candidate = object.cloneDeep(randomPerson());
		dotprop.set(candidate, PRIMARY_KEY_INDEX, string.ofLength(10));
		for (const index of indexes) {
			dotprop.set(candidate, index, null);
		}

		const indexWithVal = PersonIndexes.II_COUNTRY_CODE;
		dotprop.set(candidate, indexWithVal, string.ofLength(2));
		store.insert([candidate]);

		const removed = store.remove(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX]);

		expect(removed).to.be.deep.eq(candidate);
		expect(store.read(PRIMARY_KEY_INDEX, candidate[PRIMARY_KEY_INDEX])).to.be.ofSize(0);

		const predicate = (rec: Person) => rec[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
		const indexVal = dotprop.get(candidate, indexWithVal) as IndexValue;
		expect(store.read(indexWithVal, indexVal).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
	});
});
