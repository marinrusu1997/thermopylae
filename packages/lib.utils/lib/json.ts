import type { AnyFunction } from 'ts-essentials';

type JsonPrimitive = string | number | boolean | null | undefined;

type JsonValue =
	| JsonPrimitive
	| JsonValue[]
	| {
			[key: string]: JsonValue;
	  };

type NotAssignableToJson = bigint | symbol | AnyFunction;

type JsonCompatible<T> = unknown extends T
	? never
	: {
			[P in keyof T]: T[P] extends JsonValue ? T[P] : T[P] extends NotAssignableToJson ? never : JsonCompatible<T[P]>;
		};

interface TypedJsonInterface {
	parse<T>(text: string | { toString(): string } | null, reviver?: (this: unknown, key: string, value: unknown) => unknown): T;
	stringify<T>(value: JsonCompatible<T>, replacer?: (this: unknown, key: string, value: unknown) => unknown, space?: string | number): string;
	stringify<T>(value: JsonCompatible<T>, replacer?: (number | string)[] | null, space?: string | number): string;
}

// https://hackernoon.com/mastering-type-safe-json-serialization-in-typescript
const TypedJson: TypedJsonInterface = {
	parse<T>(text: string | { toString(): string } | null, reviver?: (this: unknown, key: string, value: unknown) => unknown): T {
		return JSON.parse(text as string, reviver) as T;
	},
	stringify<T>(
		value: JsonCompatible<T>,
		replacer?: ((this: unknown, key: string, value: unknown) => unknown) | (number | string)[] | null,
		space?: string | number
	): string {
		return JSON.stringify(value, replacer as (this: unknown, key: string, value: unknown) => unknown, space);
	}
};

function toJsonValue<T>(value: JsonCompatible<T>): JsonValue {
	return value;
}

export { TypedJson, toJsonValue };
export type { JsonCompatible };
