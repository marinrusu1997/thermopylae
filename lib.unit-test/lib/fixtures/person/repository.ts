import { object } from '@thermopylae/lib.utils';
import { Person } from './typings';
import { generateTestData } from './generation';

let PersonsRepo: Array<Person>;

async function getPersonRepositoryClone(): Promise<Array<Person>> {
	if (PersonsRepo == null) {
		PersonsRepo = await generateTestData(100);
	}
	return PersonsRepo.map((person) => object.cloneDeep(person));
}

export { getPersonRepositoryClone };
