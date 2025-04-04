import { type Person, getPersonRepositoryClone } from '@thermopylae/dev.unit-test';
import { deepFreeze } from '@thermopylae/lib.utils';
import randomItem from 'random-item';
import type { DeepReadonly } from 'ts-essentials';

type ReadonlyPerson = DeepReadonly<Person>;

const NOT_FOUND_IDX = -1;

const PersonsRepo = deepFreeze(await getPersonRepositoryClone());

function randomPerson(): Person {
	return structuredClone(randomItem(PersonsRepo) as Person);
}

export { PersonsRepo, randomPerson, NOT_FOUND_IDX };
export type { ReadonlyPerson };
