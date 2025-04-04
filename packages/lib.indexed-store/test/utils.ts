import { type Person, getPersonRepositoryClone } from '@thermopylae/dev.unit-test';
import { array } from '@thermopylae/lib.utils';
import { beforeEach } from 'vitest';

const NOT_FOUND_IDX = -1;

let PersonsRepo: Array<Person>;

beforeEach(async () => {
	PersonsRepo = await getPersonRepositoryClone();
});

function randomPerson(): Person {
	return array.randomElement(PersonsRepo);
}

export { PersonsRepo, randomPerson, NOT_FOUND_IDX };
