// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import colors from 'colors';
import { Exception } from '@thermopylae/lib.exception';
import { ArcEvictionPolicy, EvictableCacheEntry, SEGMENT_TYPE_SYM } from '../../../lib/policies/eviction/arc';
import { EntryPoolCacheBackend } from '../../../lib';
import { NEXT_SYM, PREV_SYM } from '../../../lib/data-structures/list/doubly-linked';

describe(`${colors.magenta(ArcEvictionPolicy.name)} spec`, () => {
	it('should work', () => {
		const backend = new EntryPoolCacheBackend<string, string, EvictableCacheEntry<string, string>>(4);
		const policy = new ArcEvictionPolicy<string, string>(4);

		const EVICTED_KEYS = new Array<string>();
		policy.setDeleter((evictedEntry) => {
			const evictedKey = evictedEntry.key;
			const evictableEntry = evictedEntry as EvictableCacheEntry<string, string>;

			policy.onDelete(evictableEntry);
			backend.del(evictableEntry);

			expect(evictableEntry[PREV_SYM]).to.be.eq(null);
			expect(evictableEntry[NEXT_SYM]).to.be.eq(null);
			expect(evictableEntry[SEGMENT_TYPE_SYM]).to.be.eq(undefined);
			expect(evictableEntry.value).to.be.eq(undefined);
			expect(evictableEntry.key).to.be.eq(undefined);

			EVICTED_KEYS.push(evictedKey);
		});

		/* Throw */
		expect(() => new ArcEvictionPolicy(1)).to.throw(Exception);
		expect(() => new ArcEvictionPolicy(0)).to.throw(Exception);

		/* Encoding: T1 -> T2 */

		/* Available -> Available */
		policy.onSet(backend.set('1-B2', '1-B2')); // T1(1) <-> T2(2)
		policy.onHit(backend.get('1-B2')!); // T1(2) <-> T2(1)

		/* Available -> Full */
		policy.onSet(backend.set('2-B2', '2-B2')); // T1(1) <-> T2(1)
		policy.onHit(backend.get('2-B2')!); // T1(2) <-> T2(0)

		policy.onSet(backend.set('3-B2', '3-B2')); // T1(1) <-> T2(0)
		policy.onHit(backend.get('3-B2')!); // T1(2) <-> T2(0) with eviction
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2']);

		/* Full -> Full */
		policy.onSet(backend.set('4-B1', '4-B1')); // T1(1) <-> T2(0)
		policy.onSet(backend.set('5-B1', '5-B1')); // T1(0) <-> T2(0)

		policy.onSet(backend.set('6-B1', '6-B1')); // T1(0) with eviction <-> T2(0)
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1']);
		policy.onSet(backend.set('7', '7')); // T1(0) with eviction <-> T2(0)
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1']);

		/* Available -> No Capacity */
		policy.onMiss('4-B1'); // T1(1) <-> T2(0)
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2']);
		policy.onMiss('5-B1'); // T1(2) <-> T2(0) No Capacity
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2']);

		policy.onHit(backend.get('6-B1')!); // T1 reorder from [_, _, 6, 7] to [_, _, 7, 6]

		/* Full -> No Capacity */
		policy.onSet(backend.set('8-B1', '8-B1')); // T1 order [_, 7, 6, 8]
		policy.onSet(backend.set('9-B1', '9-B1')); // T1 order [7, 6, 8, 9]
		expect(backend.size).to.be.eq(4);

		policy.onHit(backend.get('7')!); // T1 reorder from [7, 6, 8, 9] -> [6, 8, 9, 7]

		policy.onSet(backend.set('10-B2', '10-B2')); // T1 order [8, 9, 7, 10]
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1']);

		/* Full -> Available */
		policy.onMiss('1-B2'); // has no effect, because of B2 circular buffer
		policy.onMiss('2-B2');
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1', '8-B1']); // T1 [9, 7, 10] <-> T2 [_]
		policy.onMiss('3-B2');
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1', '8-B1', '9-B1']); // T1 [7, 10] <-> T2 [_, _]

		policy.onMiss('9-B1'); // T1 [7, 10, _] <-> T2 [_]
		policy.onMiss('8-B1'); // T1 [7, 10, _, _] <-> T2 []
		policy.onMiss('8-B1'); // T1 [7, 10, _, _] <-> T2 [] (had no effect)

		policy.onMiss('2-B2'); // T1 [7, 10, _] <-> T2 [_]
		policy.onMiss('3-B2'); // T1 [7, 10] <-> T2 [_, _]

		policy.onHit(backend.get('7')!); // T1 [_, 10] <-> T2 [7, _]
		policy.onHit(backend.get('10-B2')!); // T1 [_, _] <-> T2 [10, 7]
		expect(EVICTED_KEYS).to.be.ofSize(8);

		policy.onMiss('2-B2'); // T1 [_] <-> T2 [10, 7, _]
		policy.onMiss('3-B2'); // T1 [] <-> T2 [10, 7, _, _]
		policy.onMiss('3-B2'); // T1 [] <-> T2 [10, 7, _, _] (had no effect)
		expect(EVICTED_KEYS).to.be.ofSize(8);
		expect(backend.size).to.be.eq(2);

		/* No Capacity -> Available */
		policy.onSet(backend.set('11', '11')); // T1 [] <-> T2 [11, 10, 7, _]
		policy.onSet(backend.set('12', '12')); // T1 [] <-> T2 [12, 11, 10, 7]

		policy.onHit(backend.get('7')!); // T1 [] <-> T2 [7, 12, 11, 10]
		policy.onHit(backend.get('11')!); // T1 [] <-> T2 [11, 7, 12, 10]

		/* No Capacity -> Full */
		policy.onSet(backend.set('13', '13')); // T1 [] <-> T2 [13, 11, 7, 12]
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1', '8-B1', '9-B1', '10-B2']);
		expect(backend.size).to.be.eq(4);

		/* Clearing Up */
		policy.onClear();
		backend.clear();

		policy.onSet(backend.set('20-B2', '20-B2')); // T1 [_, 20] <-> T2 [_, _]
		policy.onSet(backend.set('21', '21')); // T1 [20, 21] <-> T2 [_, _]
		policy.onHit(backend.get('20-B2')!); // T1 [_, 21] <-> T2 [20, _]
		policy.onHit(backend.get('21')!); // T1 [_, _] <-> T2 [21, 20]

		policy.onSet(backend.set('22-B1', '22-B1')); // T1 [_, 22] <-> T2 [21, 20]
		policy.onSet(backend.set('23', '23')); // T1 [22, 23] <-> T2 [21, 20]

		policy.onSet(backend.set('24-B1', '24-B1')); // T1 [23, 24] <-> T2 [21, 20]
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1', '8-B1', '9-B1', '10-B2', '22-B1']);

		policy.onHit(backend.get('23')!); // T1 [_, 24] <-> T2 [23, 21]
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1', '8-B1', '9-B1', '10-B2', '22-B1', '20-B2']);

		policy.onMiss('1-B2'); // has no effect
		policy.onMiss('2-B2'); // has no effect
		policy.onMiss('3-B2'); // has no effect
		policy.onMiss('10-B2'); // has no effect

		policy.onMiss('4-B1'); // has no effect
		policy.onMiss('5-B1'); // has no effect
		policy.onMiss('6-B1'); // has no effect
		policy.onMiss('8-B1'); // has no effect
		policy.onMiss('9-B1'); // has no effect
		expect(EVICTED_KEYS).to.be.ofSize(11);

		policy.onMiss('20-B2'); // T1 [24] <-> T2 [_, 23, 21]
		policy.onMiss('20-B2'); // T1 [] <-> T2 [_, _, 23, 21]
		expect(EVICTED_KEYS).to.be.equalTo(['1-B2', '4-B1', '5-B1', '2-B2', '3-B2', '6-B1', '8-B1', '9-B1', '10-B2', '22-B1', '20-B2', '24-B1']);
	});
});
