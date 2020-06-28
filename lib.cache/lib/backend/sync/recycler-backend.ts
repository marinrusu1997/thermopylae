import { Undefinable } from '@thermopylae/core.declarations';
import { array } from '@thermopylae/lib.utils';
import { object as obj } from '@thermopylae/lib.pool';
import { CacheBackend, CacheEntry } from '../../contracts/sync/cache-backend';

const { ObjectPool } = obj;

class RecyclerBackend<K, V> implements CacheBackend<K, V> {
	private readonly store: Map<K, CacheEntry<V>>;

	private readonly entryPool: obj.ObjectPool<V>;

	constructor(capacity?: number) {
		this.store = new Map<K, CacheEntry<V>>();
		this.entryPool = new ObjectPool<V>({
			capacity: capacity || Infinity,
			initialFreeShapes: capacity ? array.filledWith(capacity, undefined) : undefined,
			constructor(value) {
				return value;
			},
			destructor() {
				return undefined;
			},
			initializer(_previous, value: V) {
				return value;
			}
		});
	}

	public get(key: K): Undefinable<CacheEntry<V>> {}

	set(key: K, value: V): CacheEntry<V> {
		return undefined;
	}

	del(key: K): boolean {
		return false;
	}

	keys(): Array<K> {
		return undefined;
	}

	clear(): void {}

	public get size(): number {}
}
