import type { AnyArray, Builtin, IsTuple, IsUnknown, Prettify, Writable } from 'ts-essentials';

type DeepMutable<Type> =
	Type extends Exclude<Builtin, Error>
		? Type
		: Type extends ReadonlyMap<infer Keys, infer Values>
			? Map<DeepMutable<Keys>, DeepMutable<Values>>
			: Type extends Map<infer Keys, infer Values>
				? Map<DeepMutable<Keys>, DeepMutable<Values>>
				: Type extends WeakMap<infer Keys, infer Values>
					? WeakMap<DeepMutable<Keys>, DeepMutable<Values>>
					: Type extends ReadonlySet<infer Values>
						? Set<DeepMutable<Values>>
						: Type extends Set<infer Values>
							? Set<DeepMutable<Values>>
							: Type extends WeakSet<infer Values>
								? WeakSet<DeepMutable<Values>>
								: Type extends Promise<infer Value>
									? Promise<DeepMutable<Value>>
									: Type extends AnyArray<infer Values>
										? Type extends IsTuple<Type>
											? { -readonly [Key in keyof Type]: DeepMutable<Type[Key]> }
											: DeepMutable<Values>[]
										: Type extends object
											? { -readonly [Key in keyof Type]: DeepMutable<Type[Key]> }
											: IsUnknown<Type> extends true
												? unknown
												: Type;

type Mutable<Type, Keys extends keyof Type, Scope extends 'key' | 'value' | 'key-value' = 'key'> = Prettify<
	{
		readonly [K in Exclude<keyof Type, Keys>]: Type[K];
	} & (Scope extends 'key'
		? {
				-readonly [K in Keys]: Type[K];
			}
		: Scope extends 'value'
			? {
					readonly [K in Keys]: Writable<Type[K]>;
				}
			: Scope extends 'key-value'
				? { -readonly [K in Keys]: Writable<Type[K]> }
				: never)
>;

export type { DeepMutable, Mutable };
