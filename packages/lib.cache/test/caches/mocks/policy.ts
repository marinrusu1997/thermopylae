import { expect } from '@thermopylae/dev.unit-test';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../../lib/contracts/cache-replacement-policy';
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

	public onHit(entry: CacheEntry<Key, Value>): EntryValidity {
		expect(entry.key).to.not.be.eq(undefined);
		expect(entry.value).to.not.be.eq(undefined);

		const methodBehaviour = this.methodBehaviours.get('onHit')!;
		methodBehaviour.arguments = [entry];
		methodBehaviour.calls += 1;

		if (methodBehaviour.returnValue === EntryValidity.NOT_VALID) {
			this.deleteFromCache(entry);
		}

		return methodBehaviour.returnValue;
	}

	public onMiss(key: Key): void {
		const methodBehaviour = this.methodBehaviours.get('onMiss')!;
		methodBehaviour.arguments = [key];
		methodBehaviour.calls += 1;
	}

	public onSet(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void {
		expect(entry.key).to.not.be.eq(undefined);
		expect(entry.value).to.not.be.eq(undefined);

		const methodBehaviour = this.methodBehaviours.get('onSet')!;
		methodBehaviour.arguments = [entry, argsBundle];
		methodBehaviour.calls += 1;

		if (methodBehaviour.throws) {
			throw methodBehaviour.throws;
		}
	}

	public onUpdate(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void {
		expect(entry.key).to.not.be.eq(undefined);
		expect(entry.value).to.not.be.eq(undefined);

		const methodBehaviour = this.methodBehaviours.get('onUpdate')!;
		methodBehaviour.arguments = [entry, argsBundle];
		methodBehaviour.calls += 1;

		if (methodBehaviour.throws) {
			throw methodBehaviour.throws;
		}
	}

	public onDelete(entry: CacheEntry<Key, Value>): void {
		expect(entry.key).to.not.be.eq(undefined);
		expect(entry.value).to.not.be.eq(undefined);

		const methodBehaviour = this.methodBehaviours.get('onDelete')!;
		methodBehaviour.arguments = [entry];
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
