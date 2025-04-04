type PrefixedProperties<T, Prefix extends string> = {
	[K in keyof T]: K extends `${Prefix}${string}` ? K : never;
}[keyof T];

type KeysAsValues<T extends PropertyKey> = {
	[Key in T]: Key;
};

// see https://stackoverflow.com/a/56874389
type KeysWithValueType<RecordType, ValueType, MatchType extends 'strict' | 'loose' = 'strict'> = {
	[RecordKey in keyof RecordType]-?: MatchType extends 'strict'
		? RecordType[RecordKey] extends ValueType
			? RecordKey
			: never
		: [ValueType] extends [RecordType[RecordKey]]
			? RecordKey
			: never;
}[keyof RecordType];

export type { PrefixedProperties, KeysAsValues, KeysWithValueType };
