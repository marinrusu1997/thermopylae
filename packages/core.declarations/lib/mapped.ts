// oxlint-disable no-explicit-any
import type { ObjMap } from './aliases.js';

type MaybePromise<T, B extends 'plain' | 'promise'> = {
	plain: T;
	promise: Promise<T>;
}[B];

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
	}[Keys];

type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
	}[Keys];

type Values<T extends ObjMap> = T[keyof T];

type Tuplize<T extends ObjMap[]> = Pick<T, Exclude<keyof T, Extract<keyof ObjMap[], string> | number>>;

type Xor<T extends ObjMap> = Values<{
	[K in keyof T]: T[K] & {
		[Mm in Values<{ [L in keyof Omit<T, K>]: keyof T[L] }>]?: undefined;
	};
}>;

type OneOf<T extends ObjMap[]> = Xor<Tuplize<T>>;

type Conditional<Dispatcher, Expectation, Truthy, Falsy> = Dispatcher extends Expectation ? Truthy : Falsy;

type PartialSome<T, K extends keyof T> = Omit<T, K> & Partial<T>;

type RequireSome<T, K extends keyof T> = Omit<T, K> & {
	[MK in K]-?: NonNullable<T[MK]>;
};

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

type MutableSome<T, K extends keyof T> = {
	-readonly [P in K]: T[P];
};

type NoDefinedProperties<K extends keyof any> = {
	[P in K]: never;
};

type NoDefinedPropertiesFrom<T, K extends keyof T> = {
	[P in K]: never;
};

type EitherField<T, TKey extends keyof T = keyof T> = TKey extends keyof T
	? { [P in TKey]-?: T[TKey] } & Partial<Record<Exclude<keyof T, TKey>, never>>
	: never;

type Nullable<T> = T | null;
type Undefinable<T> = T | undefined;
type Voidable<T> = T | void;
type Optional<T> = Undefinable<T>;

type DotKeyOf<T> = Exclude<keyof T, symbol | number> | string;

type Class<T> = new (...args: any[]) => T;

export type {
	MaybePromise,
	RequireAtLeastOne,
	RequireOnlyOne,
	Values,
	Tuplize,
	Xor,
	OneOf,
	Conditional,
	PartialSome,
	RequireSome,
	Mutable,
	MutableSome,
	NoDefinedProperties,
	NoDefinedPropertiesFrom,
	EitherField,
	Nullable,
	Undefinable,
	Voidable,
	Optional,
	DotKeyOf,
	Class
};
