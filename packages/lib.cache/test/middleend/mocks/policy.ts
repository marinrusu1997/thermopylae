import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../../lib/contracts/replacement-policy';
import { CacheEntry } from '../../../lib/contracts/commons';

interface MethodBehaviour {
	calls: number;
	arguments?: any[];
	returnValue?: any;
	throws?: any;
}

class PolicyMock<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	public deleteFromCache!: Deleter<Key, Value>;

	public readonly methodBehaviours: Map<keyof PolicyMock<Key, Value, ArgumentsBundle>, MethodBehaviour>;

	public constructor() {
		this.methodBehaviours = new Map<keyof PolicyMock<Key, Value, ArgumentsBundle>, MethodBehaviour>();

		const methods = (Object.getOwnPropertyNames(PolicyMock.prototype) as unknown) as Array<keyof PolicyMock<Key, Value, ArgumentsBundle>>;
		for (const method of methods) {
			this.methodBehaviours.set(method, { calls: 0 });
		}
	}

	public onGet(key: Key, entry: CacheEntry<Value>): EntryValidity {
		const methodBehaviour = this.methodBehaviours.get('onGet')!;
		methodBehaviour.arguments = [key, entry];
		methodBehaviour.calls += 1;

		if (methodBehaviour.returnValue === EntryValidity.NOT_VALID) {
			this.deleteFromCache(key, entry);
		}

		return methodBehaviour.returnValue;
	}

	public onSet(key: Key, entry: CacheEntry<Value>, argsBundle?: ArgumentsBundle): void {
		const methodBehaviour = this.methodBehaviours.get('onSet')!;
		methodBehaviour.arguments = [key, entry, argsBundle];
		methodBehaviour.calls += 1;

		if (methodBehaviour.throws) {
			throw methodBehaviour.throws;
		}
	}

	public onUpdate(key: Key, entry: CacheEntry<Value>, argsBundle?: ArgumentsBundle): void {
		const methodBehaviour = this.methodBehaviours.get('onUpdate')!;
		methodBehaviour.arguments = [key, entry, argsBundle];
		methodBehaviour.calls += 1;

		if (methodBehaviour.throws) {
			throw methodBehaviour.throws;
		}
	}

	public onDelete(key: Key, entry: CacheEntry<Value>): void {
		const methodBehaviour = this.methodBehaviours.get('onDelete')!;
		methodBehaviour.arguments = [key, entry];
		methodBehaviour.calls += 1;
	}

	public onClear(): void {
		const methodBehaviour = this.methodBehaviours.get('onClear')!;
		methodBehaviour.calls += 1;
	}

	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}
}

export { PolicyMock };
