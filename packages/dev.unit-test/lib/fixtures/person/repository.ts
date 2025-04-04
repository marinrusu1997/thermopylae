import { generateTestData } from './generation.js';
import type { Person } from './typings.js';

let PersonsRepo: Array<Person>;

async function getPersonRepositoryClone(): Promise<Array<Person>> {
	if (PersonsRepo == null) {
		PersonsRepo = await generateTestData(100);
	}
	return PersonsRepo.map((person) => structuredClone(person));
}

export { getPersonRepositoryClone };
