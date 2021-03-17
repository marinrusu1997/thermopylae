import { EventEmitter } from 'events';
import { Label, Undefinable } from '@thermopylae/core.declarations';
import { object } from '@thermopylae/lib.utils';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheFrontend } from '../contracts/cache-frontend';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { EventListener, EventType, CacheStats } from '../contracts/commons';

interface CacheOptions<Key, Value, ArgumentBundle> {
	useClones: boolean;
	middleEnd: CacheMiddleEnd<Key, Value, ArgumentBundle>;
}

// @fixme needs to be reviewed
class Cache<Key, Value, ArgumentsBundle> extends EventEmitter implements CacheFrontend<Key, Value, ArgumentsBundle> {
	protected readonly config: CacheOptions<Key, Value, ArgumentsBundle>;

	constructor(options?: Partial<CacheOptions<Key, Value, ArgumentsBundle>>) {
		super();
		this.config = Cache.fillWithDefaults(options);
	}

	public get name(): Label {
		return Cache.name;
	}

	/**
	 * @inheritDoc
	 */
	public set(key: Key, value: Value, options?: ArgumentsBundle): this {
		value = this.config.useClones ? object.cloneDeep(value) : value;
		this.config.middleEnd.set(key, value, options);

		this.emit('set', key, value);
		return this;
	}

	public get(key: Key): Undefinable<Value> {
		return this.config.middleEnd.get(key);
	}

	public take(key: Key): Undefinable<Value> {
		const value = this.config.middleEnd.get(key);
		if (value === NOT_FOUND_VALUE) {
			return value;
		}

		this.del(key);

		return value;
	}

	public has(key: Key): boolean {
		return this.config.middleEnd.get(key) !== NOT_FOUND_VALUE;
	}

	public del(key: Key): boolean {
		const deleted = this.config.middleEnd.del(key);
		if (deleted) {
			this.emit('del', key);
		}
		return deleted;
	}

	public keys(): Array<Key> {
		return this.config.middleEnd.keys();
	}

	public get stats(): CacheStats {
		return object.cloneDeep({ hits: 0, misses: 0 }); // @fixme implement stats
	}

	public get size(): number {
		return this.config.middleEnd.size;
	}

	public get empty(): boolean {
		return this.size !== 0;
	}

	public clear(): void {
		this.config.middleEnd.clear();
		this.emit('flush');
	}

	public on(event: EventType, listener: EventListener<Key, Value>): this {
		return super.on(event, listener);
	}

	private static fillWithDefaults<K, V, ArgsBundle>(options?: Partial<CacheOptions<K, V, ArgsBundle>>): CacheOptions<K, V, ArgsBundle> {
		options = options || {};
		options.useClones = options.useClones || false;
		return options as CacheOptions<K, V, ArgsBundle>;
	}
}

export { Cache, CacheOptions };
