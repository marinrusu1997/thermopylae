import { IndexValueGenerators, type Person, PersonIndexes } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { number, object, string } from '@thermopylae/lib.utils';
import { deleteProperty, getProperty, setProperty } from 'dot-prop';
import { describe, expect, it } from 'vitest';
import { ErrorCodes, type IndexValue, IndexedStore, PK_INDEX_NAME } from '../lib/index.js';
import { NOT_FOUND_IDX, PersonsRepo, randomPerson } from './utils.js';

describe(`${IndexedStore.prototype.reindex.name} spec`, () => {
	it('should not update primary index', () => {
		const store = new IndexedStore<Person>();

		const oldVal = string.random();
		const newVal = string.random();
		const reindex = () => store.reindex(PK_INDEX_NAME, oldVal, newVal, () => true);

		expect(reindex).to.throw(`Can't reindex primary index '${PK_INDEX_NAME}' value.`);
	});

	it('should throw if values are the same', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const oldVal = '';
		const newVal = oldVal;
		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, () => true);

		expect(reindex).to.throw(`New and old values for index '${PersonIndexes.I_BIRTH_YEAR}' are the same: ${JSON.stringify(oldVal)}.`);
	});

	it('should throw if old record was not found (empty index)', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });
		const originalSize = store.size;

		const candidate = randomPerson();
		const oldVal = getProperty(candidate, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const predicate = (person: Person) => person[PK_INDEX_NAME] === candidate[PK_INDEX_NAME];

		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, predicate);
		expect(reindex).to.throw(`Failed to de-index record from index '${PersonIndexes.I_BIRTH_YEAR}' with value '${oldVal}', because it wasn't found.`);
		expect(store.size).to.be.eq(originalSize);
	});

	it("should throw record if it doesn't exist", () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const indexed = randomPerson();
		store.insert([indexed]);
		const originalSize = store.size;

		const oldVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		let newVal: IndexValue;
		while ((newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!()) === oldVal);

		const predicate = (person: Person) => person[PK_INDEX_NAME] === indexed[PK_INDEX_NAME];

		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, predicate);
		expect(reindex).to.throw(`Failed to de-index record from index '${PersonIndexes.I_BIRTH_YEAR}' with value '${oldVal}', because it wasn't found.`);
		expect(store.size).to.be.eq(originalSize);
	});

	it('should index record if it was not indexed', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const indexed = randomPerson();
		store.insert([indexed]);

		let candidate: Person;
		while ((candidate = randomPerson()) === indexed);

		setProperty(candidate, PersonIndexes.I_BIRTH_YEAR, null);
		store.insert([candidate]);

		const originalSize = store.size;
		expect(originalSize).to.be.eq(2);

		const oldVal = getProperty(candidate, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = getProperty(indexed, PersonIndexes.I_BIRTH_YEAR) as IndexValue;

		store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, candidate[PK_INDEX_NAME]);
		expect(getProperty(candidate, PersonIndexes.I_BIRTH_YEAR)).to.be.eq(newVal);
		expect(store.size).to.be.eq(originalSize);

		const indexedRecords = store.read(PersonIndexes.I_BIRTH_YEAR, newVal);
		expect(indexedRecords).toStrictEqual([indexed, candidate]);
	});

	it('should throw when reindex record that was not indexed before and matcher is not value of primary key', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const record = randomPerson();
		deleteProperty(record, PersonIndexes.I_BIRTH_YEAR);
		store.insert([record]);

		const oldVal = getProperty(record, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const matcher = (rec: Person) => rec[PK_INDEX_NAME] === record[PK_INDEX_NAME];

		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, matcher);
		expect(reindex).to.throw(
			`Matcher needs to be primary key value when indexing record that was not indexed before. Context: index '${
				PersonIndexes.I_BIRTH_YEAR
			}', new value '${JSON.stringify(newVal)}'.`
		);
	});

	it('should throw when reindex record that was not indexed before and it was not found by value of primary index', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const record = randomPerson();
		deleteProperty(record, PersonIndexes.I_BIRTH_YEAR);
		store.insert([record]);

		const oldVal = getProperty(record, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const matcher = string.random();

		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, matcher);
		expect(reindex).to.throw(`No record found for index '${PK_INDEX_NAME} with matching value '${matcher}'.`);
	});

	it('should update first level index value', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);

		const birthYearIndex = store.readIndex(PersonIndexes.I_BIRTH_YEAR);

		const candidate = randomPerson();
		const oldBirthYear = candidate.birthYear;
		const predicate = (person: Person) => person[PK_INDEX_NAME] === candidate[PK_INDEX_NAME];

		/** BEFORE REINDEX (assert some invariants) */
		const countryCodeIndexRecordsLenBefore = store.read(PersonIndexes.II_COUNTRY_CODE, candidate.address.countryCode).length;
		const bankNameIndexRecordsLen = store.read(PersonIndexes.III_BANK_NAME, candidate.finance.bank.name).length;
		const originalCandidate = object.cloneDeep(candidate);

		expect(birthYearIndex.get(oldBirthYear)!.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

		/** REINDEX. */
		const newBirthYear = number.randomInt(2010, 2020);
		store.reindex(PersonIndexes.I_BIRTH_YEAR, candidate.birthYear, newBirthYear, candidate[PK_INDEX_NAME]);

		expect(originalCandidate).to.not.be.deep.eq(candidate);
		expect(getProperty(candidate, PersonIndexes.I_BIRTH_YEAR)).to.be.eq(newBirthYear);

		/** AFTER REINDEX. */
		expect(birthYearIndex.get(oldBirthYear)!.findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
		expect(birthYearIndex.get(newBirthYear)!.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

		const countryCodeIndexRecords = store.read(PersonIndexes.II_COUNTRY_CODE, candidate.address.countryCode);
		const bankNameIndexRecords = store.read(PersonIndexes.III_BANK_NAME, originalCandidate.finance.bank.name);

		expect(countryCodeIndexRecordsLenBefore).to.be.eq(countryCodeIndexRecords.length);
		expect(countryCodeIndexRecords.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

		expect(bankNameIndexRecordsLen).to.be.eq(bankNameIndexRecords.length);
		expect(bankNameIndexRecords.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);
	});

	it('should update nested level index', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);

		const candidate = randomPerson();
		const predicate = (person: Person) => person[PK_INDEX_NAME] === candidate[PK_INDEX_NAME];
		const originalSize = store.size;

		for (const indexName of indexes) {
			const originalCandidate = object.cloneDeep(candidate);

			const oldValue = getProperty(originalCandidate, indexName) as IndexValue;
			const newValue = IndexValueGenerators.get(indexName)!();

			expect(store.read(indexName, oldValue).findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);
			expect(store.read(indexName, newValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);

			store.reindex(indexName, oldValue, newValue, predicate);
			expect(candidate).to.not.be.deep.eq(originalCandidate);
			expect(getProperty(candidate, indexName)).to.be.deep.eq(newValue); // it updated value

			expect(store.read(indexName, oldValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX); // de-indexed
			expect(store.read(indexName, newValue).findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX); // indexed under new value

			expect(store.size).to.be.eq(originalSize); // nothing changed in records no
		}
	});

	it('should de-index record when new index value is a nullable one', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);

		const candidate = randomPerson();
		const predicate = (person: Person) => person[PK_INDEX_NAME] === candidate[PK_INDEX_NAME];
		const originalSize = store.size;

		for (const indexName of indexes) {
			const originalCandidate = object.cloneDeep(candidate);

			const oldIndexValue = getProperty(originalCandidate, indexName) as IndexValue;
			const newIndexValue = null;

			store.reindex(indexName, oldIndexValue, newIndexValue, predicate);
			expect(store.size).to.be.eq(originalSize); // nothing changed in records no

			expect(candidate).to.not.be.deep.eq(originalCandidate);
			expect(getProperty(candidate, indexName)).to.be.deep.eq(newIndexValue); // it updated value

			// record was de-indexed
			expect(store.read(indexName, oldIndexValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
			expect(() => store.read(indexName, newIndexValue).find(predicate))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.NULLABLE_INDEX_VALUE_NOT_ALLOWED);
		}
	});
});
