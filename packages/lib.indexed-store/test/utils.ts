import { chai } from '@thermopylae/lib.unit-test';
import { getPersonRepositoryClone, Person } from '@thermopylae/lib.unit-test/dist/fixtures/person';
import { beforeEach } from 'mocha';
import { array } from '@thermopylae/lib.utils';

const { expect } = chai;

const NOT_FOUND_IDX = -1;

// eslint-disable-next-line import/no-mutable-exports
let PersonsRepo: Array<Person>;

// eslint-disable-next-line mocha/no-hooks-for-single-case
beforeEach(async () => {
	PersonsRepo = await getPersonRepositoryClone();
});

function randomPerson(): Person {
	return array.randomElement(PersonsRepo);
}

export { PersonsRepo, expect, randomPerson, NOT_FOUND_IDX };