// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, afterEach } from 'mocha';
import colors from 'colors';
import { expect } from '@thermopylae/dev.unit-test';
import { CacheEntryWithDependencies, KeysDependenciesEvictionPolicy } from '../../../lib/policies/eviction/dependencies';
import { EsMapCacheBackend } from '../../../lib';
import { DEPENDENCIES_SYM, DEPENDENTS_SYM } from '../../../lib/data-structures/dependency-graph';

describe(`${colors.magenta(KeysDependenciesEvictionPolicy.name)} spec`, () => {
	const BACKEND = new EsMapCacheBackend<string, string, CacheEntryWithDependencies<string, string>>();
	const EVICTED_KEYS = new Array<string>();

	afterEach(() => {
		BACKEND.clear();
		EVICTED_KEYS.length = 0;
	});

	describe('no cycles spec', () => {
		function policyFactory(): KeysDependenciesEvictionPolicy<string, string> {
			const policy = new KeysDependenciesEvictionPolicy<string, string>(BACKEND);

			BACKEND.set('a', 'a');
			BACKEND.set('b', 'b');
			BACKEND.set('c', 'c');
			BACKEND.set('d', 'd');
			BACKEND.set('e', 'e');
			BACKEND.set('f', 'f');

			policy.onSet(BACKEND.get('a')!);
			policy.onSet(BACKEND.get('b')!, { dependents: ['a'] });
			policy.onSet(BACKEND.get('c')!, { dependents: ['a'] });
			policy.onSet(BACKEND.get('d')!, { dependents: ['a', 'b', 'c'] });
			policy.onSet(BACKEND.get('e')!, { dependents: ['a', 'c', 'd'] });
			policy.onSet(BACKEND.get('f')!);

			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
				policy.onDelete(entryWithDeps);
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
				policy.onDelete(deletedEntry);

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

			policy.onDelete(BACKEND.get('b')!);
			expect(EVICTED_KEYS).to.be.containing('d');
			expect(EVICTED_KEYS).to.be.containing('e');

			policy.onDelete(BACKEND.get('c')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			policy.onDelete(BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			policy.onDelete(BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});

		it('deletes all nodes starting from node c', () => {
			const policy = policyFactory();

			policy.onDelete(BACKEND.get('c')!);
			expect(EVICTED_KEYS).to.be.containing('d');
			expect(EVICTED_KEYS).to.be.containing('e');

			policy.onDelete(BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.containing('b');

			policy.onDelete(BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(3);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});

		it('deletes all nodes starting from node d', () => {
			const policy = policyFactory();

			policy.onDelete(BACKEND.get('d')!);
			expect(EVICTED_KEYS).to.be.containing('e');

			policy.onDelete(BACKEND.get('c')!);
			expect(EVICTED_KEYS).to.be.ofSize(1);

			policy.onDelete(BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.containing('b');

			policy.onDelete(BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(2);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});

		it('deletes all nodes starting from node e', () => {
			const policy = policyFactory();

			policy.onDelete(BACKEND.get('e')!);
			expect(EVICTED_KEYS).to.be.ofSize(0);

			policy.onDelete(BACKEND.get('a')!);
			expect(EVICTED_KEYS).to.be.containing('b');
			expect(EVICTED_KEYS).to.be.containing('c');
			expect(EVICTED_KEYS).to.be.containing('d');

			policy.onDelete(BACKEND.get('f')!);
			expect(EVICTED_KEYS).to.be.ofSize(3);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
				expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
			}
		});
	});

	describe('cycles spec', () => {
		function policyFactory(): KeysDependenciesEvictionPolicy<string, string> {
			const policy = new KeysDependenciesEvictionPolicy<string, string>(BACKEND);

			BACKEND.set('0', '0');
			BACKEND.set('1', '1');
			BACKEND.set('2', '2');
			BACKEND.set('3', '3');

			policy.onSet(BACKEND.get('0')!);
			policy.onSet(BACKEND.get('1')!, { dependents: ['0'] });
			policy.onSet(BACKEND.get('2')!, { dependencies: ['0'], dependents: ['0', '1'] });
			policy.onSet(BACKEND.get('3')!, { dependencies: ['3'], dependents: ['2'] });

			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
				policy.onDelete(entryWithDeps);
			});

			return policy;
		}

		it('deletes all nodes starting from node 0, 1, 2', () => {
			for (let i = 0; i < 3; i++) {
				const policy = policyFactory();
				const key = String(i);

				policy.onDelete(BACKEND.get(key)!);

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

			policy.onDelete(BACKEND.get('3')!);
			expect(EVICTED_KEYS).to.be.ofSize(0); // it had no deps

			policy.onDelete(BACKEND.get('0')!);
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
		const policy = new KeysDependenciesEvictionPolicy<string, string>(BACKEND);

		BACKEND.set('a', 'a');
		BACKEND.set('b', 'b');

		policy.onSet(BACKEND.get('a')!);
		policy.onSet(BACKEND.get('b')!, { dependents: ['a', 'a'] });

		policy.setDeleter((evictedEntry) => {
			EVICTED_KEYS.push(evictedEntry.key);

			const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
			policy.onDelete(entryWithDeps);
		});

		policy.onDelete(BACKEND.get('a')!);
		expect(EVICTED_KEYS).to.be.ofSize(1); // it had 1 dep
		expect(EVICTED_KEYS).to.be.containing('b');

		for (const entry of BACKEND.values()) {
			expect(entry[DEPENDENCIES_SYM]).to.be.eq(undefined);
			expect(entry[DEPENDENTS_SYM]).to.be.eq(undefined);
		}
	});
});
