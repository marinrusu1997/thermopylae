import type { DeepReadonly } from 'ts-essentials';

function noMapMutation(): never {
	throw new Error('Map is read-only');
}

function noSetMutation(): never {
	throw new Error('Set is read-only');
}

function noWeakSetMutation(): never {
	throw new Error('WeakSet is read-only');
}

function noWeakMapMutation(): never {
	throw new Error('WeakMap is read-only');
}

function deepFreeze<T extends object>(obj: T): DeepReadonly<T> {
	switch (true) {
		case obj instanceof Map:
			obj.clear = noMapMutation;
			obj.delete = noMapMutation;
			obj.set = noMapMutation;
			break;
		case obj instanceof Set:
			obj.add = noSetMutation;
			obj.clear = noSetMutation;
			obj.delete = noSetMutation;
			break;
		case obj instanceof WeakSet:
			obj.add = noWeakSetMutation;
			obj.delete = noWeakSetMutation;
			break;
		case obj instanceof WeakMap:
			obj.set = noWeakMapMutation;
			obj.delete = noWeakMapMutation;
			break;
		case ArrayBuffer.isView(obj):
			return obj as DeepReadonly<T>;
		default:
			break;
	}

	// Freeze self
	Object.freeze(obj);

	for (const propertyName of Object.getOwnPropertyNames(obj) as unknown as (keyof T)[]) {
		freezeProperty(obj, propertyName);
	}
	for (const propertySymbol of Object.getOwnPropertySymbols(obj)) {
		freezeProperty(obj, propertySymbol);
	}

	return obj as DeepReadonly<T>;
}

function freezeProperty<T extends object>(obj: T, propertyName: keyof T | symbol): void {
	const prop = obj[propertyName as keyof T];
	const type = typeof prop;

	// Freeze prop if it is an object or function and also not already frozen
	if ((type === 'object' || type === 'function') && !Object.isFrozen(prop)) {
		deepFreeze(prop as object);
	}
}

export { deepFreeze };
