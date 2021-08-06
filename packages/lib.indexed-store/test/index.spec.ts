import { Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import { describe, it } from 'mocha';
import { IndexedStore, PK_INDEX_NAME } from '../lib';
import { expect, PersonsRepo } from './utils';

describe(`${IndexedStore.name} spec`, () => {
	describe('constructor', () => {
		it('creates store with primary index', () => {
			let storage = new IndexedStore<Person>();
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);

			storage = new IndexedStore<Person>({ indexes: [] });
			expect(storage.indexes).to.be.equalTo([PK_INDEX_NAME]);
		});

		it('creates store with secondary indexes', () => {
			const indexes: Array<string> = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			expect(storage.indexes).to.be.containingAllOf(indexes.concat([PK_INDEX_NAME]));
		});
	});

	describe('values spec', () => {
		it('should return no values when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			expect(storage.values.length).to.be.eq(0);
		});

		it('should return all values from storage', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);

			expect(storage.size).to.be.eq(PersonsRepo.length);
			expect(storage.values.length).to.be.eq(storage.size);
			expect(storage.values).to.be.containingAllOf(PersonsRepo);
		});
	});

	describe('iterator spec', () => {
		it('should iterate over no records when storage is empty', () => {
			const storage = new IndexedStore<Person>();
			let counter = 0;
			for (const _ of storage) {
				counter += 1;
			}
			expect(counter).to.be.eq(0);
		});

		it('should iterate over all records from storage', () => {
			const indexes = Object.values(PersonIndexes);
			const storage = new IndexedStore<Person>({ indexes });
			storage.insert(PersonsRepo);
			expect(storage.size).to.be.eq(PersonsRepo.length);

			const iterated = new Set<Person>();
			for (const record of storage) {
				iterated.add(record);
			}
			expect(iterated.size).to.be.eq(PersonsRepo.length);
		});
	});
});
