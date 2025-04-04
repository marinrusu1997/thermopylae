import type { ObjMap } from './aliases.js';

export type MaybePromise<T, B extends 'plain' | 'promise'> = {
	plain: T;
	promise: Promise<T>;
}[B];

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
	}[Keys];

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
	}[Keys];

export type Values<T extends ObjMap> = T[keyof T];

export type Tuplize<T extends ObjMap[]> = Pick<T, Exclude<keyof T, Extract<keyof ObjMap[], string> | number>>;

export type Xor<T extends ObjMap> = Values<{
	[K in keyof T]: T[K] & {
		[M in Values<{ [L in keyof Omit<T, K>]: keyof T[L] }>]?: undefined;
	};
}>;

export type OneOf<T extends ObjMap[]> = Xor<Tuplize<T>>;

export type Conditional<Dispatcher, Expectation, Truthy, Falsy> = Dispatcher extends Expectation ? Truthy : Falsy;

export type PartialSome<T, K extends keyof T> = Omit<T, K> & Partial<T>;

export type RequireSome<T, K extends keyof T> = Omit<T, K> & {
	[MK in K]-?: NonNullable<T[MK]>;
};

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type MutableSome<T, K extends keyof T> = {
	-readonly [P in K]: T[P];
};

export type NoDefinedProperties<K extends keyof any> = {
	[P in K]: never;
};

export type NoDefinedPropertiesFrom<T, K extends keyof T> = {
	[P in K]: never;
};

export type EitherField<T, TKey extends keyof T = keyof T> = TKey extends keyof T
	? { [P in TKey]-?: T[TKey] } & Partial<Record<Exclude<keyof T, TKey>, never>>
	: never;

export type Nullable<T> = T | null;
export type Undefinable<T> = T | undefined;
export type Voidable<T> = T | void;
export type Optional<T> = Undefinable<T>;

export type DotKeyOf<T> = Exclude<keyof T, symbol | number> | string;

export type Class<T> = { new (...args: any[]): T };
