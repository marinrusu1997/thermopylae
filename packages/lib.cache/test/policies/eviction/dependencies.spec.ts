import colors from 'colors';
import { afterEach, describe, expect, it } from 'vitest';
import { DEPENDENCIES_SYM, DEPENDENTS_SYM } from '../../../lib/data-structures/dependency-graph.js';
import { EsMapCacheBackend } from '../../../lib/index.js';
import { type CacheEntryWithDependencies, KeysDependenciesEvictionPolicy } from '../../../lib/policies/eviction/dependencies.js';

describe(`${colors.magenta(KeysDependenciesEvictionPolicy.name)} spec`, () => {
	const BACKEND = new EsMapCacheBackend<string, string, CacheEntryWithDependencies<string, string>>();
	const EVICTED_KEYS = new Array<string>();

	afterEach(() => {
		BACKEND.clear();
		EVICTED_KEYS.length = 0;
	});

	function get(key: string): CacheEntryWithDependencies<string, string> {
		const entry = BACKEND.get(key);
		if (!entry) {
			throw new Error(`No entry for '${key}'`);
		}
		return entry;
	}

	describe('no cycles spec', () => {
		function policyFactory(): KeysDependenciesEvictionPolicy<string, string> {
			const policy = new KeysDependenciesEvictionPolicy<string, string>(BACKEND);

			BACKEND.set('a', 'a');
			BACKEND.set('b', 'b');
			BACKEND.set('c', 'c');
			BACKEND.set('d', 'd');
			BACKEND.set('e', 'e');
			BACKEND.set('f', 'f');

			policy.onSet(get('a'));
			policy.onSet(get('b'), { dependents: ['a'] });
			policy.onSet(get('c'), { dependents: ['a'] });
			policy.onSet(get('d'), { dependents: ['a', 'b', 'c'] });
			policy.onSet(get('e'), { dependents: ['a', 'c', 'd'] });
			policy.onSet(get('f'));

			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
				policy.onDelete(entryWithDeps);
			});

			return policy;
		}

		it('deletes entries in cascade (DAG with simple scenarios)', () => {
			expect.hasAssertions();

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

				const deletedEntry = get(deletedKey);
				policy.onDelete(deletedEntry);

				expect(deletedEntry[DEPENDENCIES_SYM]).toBeUndefined();
				expect(deletedEntry[DEPENDENTS_SYM]).toBeUndefined();

				expect(EVICTED_KEYS.length).to.be.eq(evictedDependencies.length); // 'deletedKey' was deleted already by us
				for (const evictedDepKey of evictedDependencies) {
					expect(EVICTED_KEYS).to.contain(evictedDepKey);

					const evictedDepEntry = get(evictedDepKey);
					expect(evictedDepEntry[DEPENDENCIES_SYM]).toBeUndefined();
					expect(evictedDepEntry[DEPENDENTS_SYM]).toBeUndefined();
				}

				BACKEND.clear();
				EVICTED_KEYS.length = 0;
			}
		});

		it('deletes all nodes starting from node b', () => {
			const policy = policyFactory();

			policy.onDelete(get('b'));
			expect(EVICTED_KEYS).to.contain('d');
			expect(EVICTED_KEYS).to.contain('e');

			policy.onDelete(get('c'));
			expect(EVICTED_KEYS).to.have.length(2);

			policy.onDelete(get('a'));
			expect(EVICTED_KEYS).to.have.length(2);

			policy.onDelete(get('f'));
			expect(EVICTED_KEYS).to.have.length(2);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
				expect(entry[DEPENDENTS_SYM]).toBeUndefined();
			}
		});

		it('deletes all nodes starting from node c', () => {
			const policy = policyFactory();

			policy.onDelete(get('c'));
			expect(EVICTED_KEYS).to.contain('d');
			expect(EVICTED_KEYS).to.contain('e');

			policy.onDelete(get('a'));
			expect(EVICTED_KEYS).to.contain('b');

			policy.onDelete(get('f'));
			expect(EVICTED_KEYS).to.have.length(3);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
				expect(entry[DEPENDENTS_SYM]).toBeUndefined();
			}
		});

		it('deletes all nodes starting from node d', () => {
			const policy = policyFactory();

			policy.onDelete(get('d'));
			expect(EVICTED_KEYS).to.contain('e');

			policy.onDelete(get('c'));
			expect(EVICTED_KEYS).to.have.length(1);

			policy.onDelete(get('a'));
			expect(EVICTED_KEYS).to.contain('b');

			policy.onDelete(get('f'));
			expect(EVICTED_KEYS).to.have.length(2);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
				expect(entry[DEPENDENTS_SYM]).toBeUndefined();
			}
		});

		it('deletes all nodes starting from node e', () => {
			const policy = policyFactory();

			policy.onDelete(get('e'));
			expect(EVICTED_KEYS).to.have.length(0);

			policy.onDelete(get('a'));
			expect(EVICTED_KEYS).to.contain('b');
			expect(EVICTED_KEYS).to.contain('c');
			expect(EVICTED_KEYS).to.contain('d');

			policy.onDelete(get('f'));
			expect(EVICTED_KEYS).to.have.length(3);

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
				expect(entry[DEPENDENTS_SYM]).toBeUndefined();
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

			policy.onSet(get('0'));
			policy.onSet(get('1'), { dependents: ['0'] });
			policy.onSet(get('2'), { dependencies: ['0'], dependents: ['0', '1'] });
			policy.onSet(get('3'), { dependencies: ['3'], dependents: ['2'] });

			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
				policy.onDelete(entryWithDeps);
			});

			return policy;
		}

		it('deletes all nodes starting from node 0, 1, 2', () => {
			expect.hasAssertions();

			for (let i = 0; i < 3; i++) {
				const policy = policyFactory();
				const key = String(i);

				policy.onDelete(get(key));

				expect(EVICTED_KEYS).to.have.length(3);

				for (let j = 0; j <= 3; j++) {
					if (j !== i) {
						expect(EVICTED_KEYS).to.contain(String(j));
					}
				}

				for (const entry of BACKEND.values()) {
					expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
					expect(entry[DEPENDENTS_SYM]).toBeUndefined();
				}

				BACKEND.clear();
				EVICTED_KEYS.length = 0;
			}
		});

		it('deletes all nodes starting from node 3', () => {
			const policy = policyFactory();

			policy.onDelete(get('3'));
			expect(EVICTED_KEYS).to.have.length(0); // it had no deps

			policy.onDelete(get('0'));
			expect(EVICTED_KEYS).to.have.length(2); // it had 2 deps
			expect(EVICTED_KEYS).to.contain('1');
			expect(EVICTED_KEYS).to.contain('2');

			for (const entry of BACKEND.values()) {
				expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
				expect(entry[DEPENDENTS_SYM]).toBeUndefined();
			}
		});
	});

	it('handles duplicated dependencies', () => {
		const policy = new KeysDependenciesEvictionPolicy<string, string>(BACKEND);

		BACKEND.set('a', 'a');
		BACKEND.set('b', 'b');

		policy.onSet(get('a'));
		policy.onSet(get('b'), { dependents: ['a', 'a'] });

		policy.setDeleter((evictedEntry) => {
			EVICTED_KEYS.push(evictedEntry.key);

			const entryWithDeps = evictedEntry as CacheEntryWithDependencies<string, string>;
			policy.onDelete(entryWithDeps);
		});

		policy.onDelete(get('a'));
		expect(EVICTED_KEYS).to.have.length(1); // it had 1 dep
		expect(EVICTED_KEYS).to.contain('b');

		for (const entry of BACKEND.values()) {
			expect(entry[DEPENDENCIES_SYM]).toBeUndefined();
			expect(entry[DEPENDENTS_SYM]).toBeUndefined();
		}
	});
});
