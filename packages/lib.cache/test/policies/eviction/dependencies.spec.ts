import { describe, it, afterEach } from 'mocha';
import colors from 'colors';
import { expect } from '@thermopylae/lib.unit-test';
import { CacheEntryWithDependencies, EntryDependenciesEvictionPolicy } from '../../../lib/policies/eviction/dependencies';
import { EsMapBackend } from '../../../lib/backend/es-map';
import { DEPENDENCIES_SYM, DEPENDENTS_SYM } from '../../../lib/data-structures/dependency-graph';

describe(`${colors.magenta(EntryDependenciesEvictionPolicy.name)} spec`, () => {
	const BACKEND = new EsMapBackend<string, string, CacheEntryWithDependencies<string, string>>();
	const EVICTED_KEYS = new Array<string>();

	afterEach(() => {
		BACKEND.clear();
		EVICTED_KEYS.length = 0;
	});

	describe('no cycles spec', () => {
		function policyFactory(): EntryDependenciesEvictionPolicy<string, string> {
			const policy = new EntryDependenciesEvictionPolicy<string, string>(BACKEND);

			BACKEND.set('a', 'a');
			BACKEND.set('b', 'b');
			BACKEND.set('c', 'c');
			BACKEND.set('d', 'd');
			BACKEND.set('e', 'e');
			BACKEND.set('f', 'f');

			policy.onSet('a', BACKEND.get('a')!);
			policy.onSet('b', BACKEND.get('b')!, { dependents: ['a'] });
			policy.onSet('c', BACKEND.get('c')!, { dependents: ['a'] });
			policy.onSet('d', BACKEND.get('d')!, { dependents: ['a', 'b', 'c'] });
			policy.onSet('e', BACKEND.get('e')!, { dependents: ['a', 'c', 'd'] });
			policy.onSet('f', BACKEND.get('f')!);

			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
				policy.onDelete(evictedKey, entryWithDeps);
			});

			return policy;
		}

		it('deletes entries in cascade (DAG with simple scenarios)', () => {
			const scenarios = new Map<string, Array<string>>([
				['a', ['b', 'c', 'd', 'e']],
				['b', ['d', 'e']],
				['c', ['d', 'e']],
				['d', ['e']],
				['e', []],
				['f', []]
			]);

			for (const [deletedKey, evictedDependencies] of scenarios) {
				const policy = policyFactory();

				const deletedEntry = BACKEND.get(deletedKey)!;
				policy.onDelete(deletedKey, deletedEntry);

				expect(deletedEntry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(deletedEntry[DEPENDENTS_SYM]).to.be.eq(undefined);

				expect(EVICTED_KEYS.length).to.be.eq(evictedDependencies.length); // 'deletedKey' was deleted already by us
				for (const evictedDepKey of evictedDependencies) {
					expect(EVICTED_KEYS).to.be.containing(evictedDepKey);

					const evictedDepEntry = BACKEND.get(evictedDepKey)!;
					expect(evictedDepEntry[DEPENDENCIES_SYM]).to.be.eq(undefined);
					expect(evictedDepEntry[DEPENDENTS_SYM]).to.be.eq(undefined);
				}

				BACKEND.clear();
				EVICTED_KEYS.length = 0;
			}
		});

		it('deletes all nodes starting from node b', () => {
			const policy = policyFactory();

			policy.onDelete('b', BACKEND.get('b')!);
			expect(EVICTED_KEYS).to.be.containing('d');
			expect(EVICTED_KEYS).to.be.containing('e');

			policy.onDelete('c', BACKEND.get('c')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			policy.onDelete('a', BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			policy.onDelete('f', BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});

		it('deletes all nodes starting from node c', () => {
			const policy = policyFactory();

			policy.onDelete('c', BACKEND.get('c')!);
			expect(EVICTED_KEYS).to.be.containing('d');
			expect(EVICTED_KEYS).to.be.containing('e');

			policy.onDelete('a', BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.containing('b');

			policy.onDelete('f', BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(3);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});

		it('deletes all nodes starting from node d', () => {
			const policy = policyFactory();

			policy.onDelete('d', BACKEND.get('d')!);
			expect(EVICTED_KEYS).to.be.containing('e');

			policy.onDelete('c', BACKEND.get('c')!);
			expect(EVICTED_KEYS).to.be.ofSize(1);

			policy.onDelete('a', BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.containing('b');

			policy.onDelete('f', BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});

		it('deletes all nodes starting from node e', () => {
			const policy = policyFactory();

			policy.onDelete('e', BACKEND.get('e')!);
			expect(EVICTED_KEYS).to.be.ofSize(0);

			policy.onDelete('a', BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.containing('b');
			expect(EVICTED_KEYS).to.be.containing('c');
			expect(EVICTED_KEYS).to.be.containing('d');

			policy.onDelete('f', BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(3);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});
	});

	describe('cycles spec', () => {
		function policyFactory(): EntryDependenciesEvictionPolicy<string, string> {
			const policy = new EntryDependenciesEvictionPolicy<string, string>(BACKEND);

			BACKEND.set('0', '0');
			BACKEND.set('1', '1');
			BACKEND.set('2', '2');
			BACKEND.set('3', '3');

			policy.onSet('0', BACKEND.get('0')!);
			policy.onSet('1', BACKEND.get('1')!, { dependents: ['0'] });
			policy.onSet('2', BACKEND.get('2')!, { dependencies: ['0'], dependents: ['0', '1'] });
			policy.onSet('3', BACKEND.get('3')!, { dependencies: ['3'], dependents: ['2'] });

			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
				policy.onDelete(evictedKey, entryWithDeps);
			});

			return policy;
		}

		it('deletes all nodes starting from node 0, 1, 2', () => {
			for (let i = 0; i < 3; i++) {
				const policy = policyFactory();
				const key = String(i);

				policy.onDelete(key, BACKEND.get(key)!);

				expect(EVICTED_KEYS).to.be.ofSize(3);

				for (let j = 0; j <= 3; j++) {
					if (j !== i) {
						expect(EVICTED_KEYS).to.be.containing(String(j));
					}
				}

				for (const entry of BACKEND.values()) {
					expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
					expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
				}

				BACKEND.clear();
				EVICTED_KEYS.length = 0;
			}
		});

		it('deletes all nodes starting from node 3', () => {
			const policy = policyFactory();

			policy.onDelete('3', BACKEND.get('3')!);
			expect(EVICTED_KEYS).to.be.ofSize(0); // it had no deps

			policy.onDelete('0', BACKEND.get('0')!);
			expect(EVICTED_KEYS).to.be.ofSize(2); // it had 2 deps
			expect(EVICTED_KEYS).to.be.containing('1');
			expect(EVICTED_KEYS).to.be.containing('2');

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});
	});

	it('handles duplicated dependencies', () => {
		const policy = new EntryDependenciesEvictionPolicy<string, string>(BACKEND);

		BACKEND.set('a', 'a');
		BACKEND.set('b', 'b');

		policy.onSet('a', BACKEND.get('a')!);
		policy.onSet('b', BACKEND.get('b')!, { dependents: ['a', 'a'] });

		policy.setDeleter((evictedKey, evictedEntry) => {
			EVICTED_KEYS.push(evictedKey);

			const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
			policy.onDelete(evictedKey, entryWithDeps);
		});

		policy.onDelete('a', BACKEND.get('a')!);
		expect(EVICTED_KEYS).to.be.ofSize(1); // it had 1 dep
		expect(EVICTED_KEYS).to.be.containing('b');

		for (const entry of BACKEND.values()) {
			expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
			expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
		}
	});
});
