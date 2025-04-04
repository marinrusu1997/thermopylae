import colors from 'colors';
import { describe, expect, it } from 'vitest';
import type { CacheEntry } from '../../lib/contracts/commons.js';
import { EntryPoolCacheBackend } from '../../lib/index.js';

describe(`${colors.magenta(EntryPoolCacheBackend.name)} spec`, () => {
	it('should manage cache entries', () => {
		const backend = new EntryPoolCacheBackend<string, string>();

		/* SET */
		const firstEntry = backend.set('a', 'a');
		const secondEntry = backend.set('b', 'b');
		expect(backend.size).to.be.eq(2);

		/* HAS */
		expect(backend.has('a')).to.be.eq(true);
		expect(backend.has('b')).to.be.eq(true);
		expect(backend.has('c')).to.be.eq(false);

		/* GET */
		expect(backend.get('a')).to.be.eq(firstEntry);
		expect(backend.get('b')).to.be.eq(secondEntry);
		expect(backend.get('c')).to.be.eq(undefined);

		/* UPDATE */
		firstEntry.value = '1';
		secondEntry.value = '2';
		expect(backend.get('a')!.value).to.be.eq('1');
		expect(backend.get('b')!.value).to.be.eq('2');

		/* ITERATION */
		const keys = new Set<string>(['a', 'b']);
		const entries = new Set<CacheEntry<string, string>>([firstEntry, secondEntry]);
		for (const [key, entry] of backend) {
			expect(keys.has(key)).to.be.eq(true);
			expect(entries.has(entry)).to.be.eq(true);

			keys.delete(key);
			entries.delete(entry);
		}
		expect(keys.size).to.be.eq(0);
		expect(entries.size).to.be.eq(0);

		/* ENTRIES ITERATION */
		entries.add(firstEntry).add(secondEntry);
		for (const entry of backend.values()) {
			expect(entries.has(entry)).to.be.eq(true);

			entries.delete(entry);
		}
		expect(entries.size).to.be.eq(0);

		/* KEYS ITERATION */
		keys.add('a').add('b');
		for (const key of backend.keys()) {
			expect(keys.has(key)).to.be.eq(true);

			keys.delete(key);
		}
		expect(keys.size).to.be.eq(0);

		/* DELETE */
		backend.del(backend.get('a')!); // deleted entry
		expect(backend.size).to.be.eq(1); // size decreased
		expect(Array.from(backend)).to.have.length(1); // iterates correctly
		expect(Array.from(backend.values())).to.have.length(1); // iterates correctly
		expect(firstEntry.value).to.be.eq(undefined); // detaches metadata
		expect(firstEntry.key).to.be.eq(undefined); // detaches metadata

		const thirdEntry = backend.set('c', 'c');
		expect(thirdEntry).to.be.eq(firstEntry); // it reused entry from pool
		expect(backend.get('c')).to.be.eq(thirdEntry); // and overwrite it
		expect(thirdEntry.value).to.be.eq('c'); // and overwrite it
		expect(backend.size).to.be.eq(2);

		/* CLEAR */
		backend.clear();
		expect(backend.size).to.be.eq(0);
		expect(Array.from(backend)).to.have.length(0); // iterates correctly
		expect(Array.from(backend.keys())).to.have.length(0); // iterates correctly
		expect(Array.from(backend.values())).to.have.length(0); // iterates correctly
		expect(backend.has('c')).to.be.eq(false);
		expect(backend.has('b')).to.be.eq(false);

		const fourthEntry = backend.set('d', 'd');
		expect(fourthEntry).to.be.eq(secondEntry); // it reused entry from pool
		expect(backend.size).to.be.eq(1);
		expect(backend.get('d')).to.be.eq(fourthEntry);
		expect(fourthEntry.value).to.be.eq('d'); // and overwrite it
	});
});
