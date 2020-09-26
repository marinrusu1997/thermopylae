import { describe, it } from 'mocha';
import { IndexValueGenerators, Person, PersonIndexes } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { number, object, string } from '@thermopylae/lib.utils';
import dotprop from 'dot-prop';
import { Exception } from '@thermopylae/lib.exception';
import { IndexedStore, IndexValue, PRIMARY_KEY_INDEX } from '../lib';
import { ErrorCodes } from '../lib/error';
import { expect, NOT_FOUND_IDX, PersonsRepo, randomPerson } from './utils';

describe(`${IndexedStore.prototype.reindex.name} spec`, () => {
	it('should not update primary index', () => {
		const store = new IndexedStore<Person>();

		const oldVal = string.ofLength(5);
		const newVal = string.ofLength(5);
		const reindex = () => store.reindex(PRIMARY_KEY_INDEX, oldVal, newVal, () => true);

		expect(reindex).to.throw(`Can't reindex primary index '${PRIMARY_KEY_INDEX}' value.`);
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
		const oldVal = dotprop.get(candidate, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

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

		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === indexed[PRIMARY_KEY_INDEX];

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

		dotprop.set(candidate, PersonIndexes.I_BIRTH_YEAR, null);
		store.insert([candidate]);

		const originalSize = store.size;
		expect(originalSize).to.be.eq(2);

		const oldVal = dotprop.get(candidate, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = dotprop.get(indexed, PersonIndexes.I_BIRTH_YEAR) as IndexValue;

		store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, candidate[PRIMARY_KEY_INDEX]);
		expect(store.size).to.be.eq(originalSize);

		const indexedRecords = store.read(PersonIndexes.I_BIRTH_YEAR, newVal);
		expect(indexedRecords).to.be.equalTo([indexed, candidate]);
	});

	it('should throw when reindex record that was not indexed before and matcher is not value of primary key', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const record = randomPerson();
		dotprop.delete(record, PersonIndexes.I_BIRTH_YEAR);
		store.insert([record]);

		const oldVal = dotprop.get(record, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const matcher = (rec: Person) => rec[PRIMARY_KEY_INDEX] === record[PRIMARY_KEY_INDEX];

		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, matcher);
		expect(reindex).to.throw(
			`Matcher needs to be primary key index when indexing record that was not indexed before. Context: index '${
				PersonIndexes.I_BIRTH_YEAR
			}', new value '${JSON.stringify(newVal)}'.`
		);
	});

	it('should throw when reindex record that was not indexed before and it was not found by value of primary index', () => {
		const store = new IndexedStore<Person>({ indexes: [PersonIndexes.I_BIRTH_YEAR] });

		const record = randomPerson();
		dotprop.delete(record, PersonIndexes.I_BIRTH_YEAR);
		store.insert([record]);

		const oldVal = dotprop.get(record, PersonIndexes.I_BIRTH_YEAR) as IndexValue;
		const newVal = IndexValueGenerators.get(PersonIndexes.I_BIRTH_YEAR)!();
		const matcher = string.ofLength(10);

		const reindex = () => store.reindex(PersonIndexes.I_BIRTH_YEAR, oldVal, newVal, matcher);
		expect(reindex).to.throw(`No record found for index '${PRIMARY_KEY_INDEX} with matching value '${matcher}'.`);
	});

	it('should update first level index value', () => {
		const indexes = Object.values(PersonIndexes);
		const store = new IndexedStore<Person>({ indexes });
		store.insert(PersonsRepo);

		const birthYearIndex = store.readIndex(PersonIndexes.I_BIRTH_YEAR);

		const candidate = randomPerson();
		const oldBirthYear = candidate.birthYear;
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];

		/** BEFORE REINDEX (assert some invariants) */
		const countryCodeIndexRecordsLenBefore = store.read(PersonIndexes.II_COUNTRY_CODE, candidate.address.countryCode).length;
		const bankNameIndexRecordsLen = store.read(PersonIndexes.III_BANK_NAME, candidate.finance.bank.name).length;
		const originalCandidate = object.cloneDeep(candidate);

		expect(birthYearIndex.get(oldBirthYear)!.findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);

		/** REINDEX */
		const newBirthYear = number.randomInt(2010, 2020);
		store.reindex(PersonIndexes.I_BIRTH_YEAR, candidate.birthYear, newBirthYear, candidate[PRIMARY_KEY_INDEX]);

		// it not touched record, just reindex it
		expect(originalCandidate).to.be.deep.eq(candidate);
		expect(candidate.birthYear).to.not.be.eq(newBirthYear);

		/** AFTER REINDEX */
		candidate.birthYear = newBirthYear;

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
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
		const originalSize = store.size;

		for (const indexName of indexes) {
			const originalCandidate = object.cloneDeep(candidate);

			const oldValue = dotprop.get(originalCandidate, indexName) as IndexValue;
			const newValue = IndexValueGenerators.get(indexName)!();

			expect(store.read(indexName, oldValue).findIndex(predicate)).to.not.be.eq(NOT_FOUND_IDX);
			expect(store.read(indexName, newValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);

			store.reindex(indexName, oldValue, newValue, predicate);
			expect(candidate).to.be.deep.eq(originalCandidate); // it didn't touched record
			expect(dotprop.get(candidate, indexName)).to.not.be.deep.eq(newValue); // and not updated value

			dotprop.set(candidate, indexName, newValue); // update the record

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
		const predicate = (person: Person) => person[PRIMARY_KEY_INDEX] === candidate[PRIMARY_KEY_INDEX];
		const originalSize = store.size;

		for (const indexName of indexes) {
			const originalCandidate = object.cloneDeep(candidate);

			const oldIndexValue = dotprop.get(originalCandidate, indexName) as IndexValue;
			const newIndexValue = null;

			store.reindex(indexName, oldIndexValue, newIndexValue, predicate);
			expect(store.size).to.be.eq(originalSize); // nothing changed in records no

			// record remained untouched
			expect(candidate).to.be.deep.eq(originalCandidate);
			expect(dotprop.get(candidate, indexName)).to.not.be.deep.eq(newIndexValue); // and not updated value

			dotprop.set(candidate, indexName, newIndexValue); // update the record

			// record was de-indexed
			expect(store.read(indexName, oldIndexValue).findIndex(predicate)).to.be.eq(NOT_FOUND_IDX);
			expect(() => store.read(indexName, newIndexValue).find(predicate))
				.to.throw(Exception)
				.haveOwnProperty('code', ErrorCodes.INVALID_TYPE);
		}
	});
});
