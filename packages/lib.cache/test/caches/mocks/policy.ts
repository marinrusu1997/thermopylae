import type { types } from '@thermopylae/lib.utils';
import { expect } from 'vitest';
import { type CacheReplacementPolicy, type Deleter, EntryValidity } from '../../../lib/typings/cache-replacement-policy.js';
import type { CacheEntry } from '../../../lib/typings/commons.js';

interface MethodBehaviour {
	calls: number;
	arguments: types.Any[];
	returnValue?: types.Any;
	throws?: Error;
}

class PolicyMock<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	public static readonly DEFAULT_METHOD_BEHAVIOUR: MethodBehaviour = Object.freeze({
		calls: 0,
		arguments: []
	});

	public deleteFromCache!: Deleter<Key, Value>;

	public readonly methodBehaviours: Map<keyof PolicyMock<Key, Value, ArgumentsBundle>, MethodBehaviour>;

	public constructor() {
		this.methodBehaviours = new Map<keyof PolicyMock<Key, Value, ArgumentsBundle>, MethodBehaviour>();

		const methods = Object.getOwnPropertyNames(PolicyMock.prototype) as unknown as (keyof PolicyMock<Key, Value, ArgumentsBundle>)[];
		for (const method of methods) {
			this.methodBehaviours.set(method, { calls: 0, arguments: [] });
		}
	}

	public onHit(entry: CacheEntry<Key, Value>): EntryValidity {
		expect(entry.key).toBeDefined();
		expect(entry.value).toBeDefined();

		const methodBehaviour = this.methodBehaviours.get('onHit');
		if (!methodBehaviour) {
			throw new Error('No method behaviour');
		}

		methodBehaviour.arguments = [entry];
		methodBehaviour.calls += 1;

		if (methodBehaviour.returnValue === EntryValidity.NOT_VALID) {
			this.deleteFromCache(entry);
		}

		return methodBehaviour.returnValue;
	}

	public onMiss(key: Key): void {
		const methodBehaviour = this.methodBehaviours.get('onMiss');
		if (!methodBehaviour) {
			throw new Error('No method behaviour');
		}

		methodBehaviour.arguments = [key];
		methodBehaviour.calls += 1;
	}

	public onSet(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void {
		expect(entry.key).toBeDefined();
		expect(entry.value).toBeDefined();

		const methodBehaviour = this.methodBehaviours.get('onSet');
		if (!methodBehaviour) {
			throw new Error('No method behaviour');
		}

		methodBehaviour.arguments = [entry, argsBundle];
		methodBehaviour.calls += 1;

		if (methodBehaviour.throws) {
			throw methodBehaviour.throws;
		}
	}

	public onUpdate(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void {
		expect(entry.key).toBeDefined();
		expect(entry.value).toBeDefined();

		const methodBehaviour = this.methodBehaviours.get('onUpdate');
		if (!methodBehaviour) {
			throw new Error('No method behaviour');
		}

		methodBehaviour.arguments = [entry, argsBundle];
		methodBehaviour.calls += 1;

		if (methodBehaviour.throws) {
			throw methodBehaviour.throws;
		}
	}

	public onDelete(entry: CacheEntry<Key, Value>): void {
		expect(entry.key).toBeDefined();
		expect(entry.value).toBeDefined();

		const methodBehaviour = this.methodBehaviours.get('onDelete');
		if (!methodBehaviour) {
			throw new Error('No method behaviour');
		}

		methodBehaviour.arguments = [entry];
		methodBehaviour.calls += 1;
	}

	public onClear(): void {
		const methodBehaviour = this.methodBehaviours.get('onClear');
		if (!methodBehaviour) {
			throw new Error('No method behaviour');
		}

		methodBehaviour.calls += 1;
	}

	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}
}

export { PolicyMock };
