type Overwrite<T, U extends { [K in keyof U]: K extends keyof T ? unknown : never }> = Omit<T, keyof U> & U;

// https://stackoverflow.com/a/57334147
type RequiredKeepUndefined<T> = { [K in keyof T]-?: [T[K]] } extends infer U
	? U extends Record<keyof U, [unknown]>
		? { [K in keyof U]: U[K][0] }
		: never
	: never;

type Underscored<T extends Record<string, unknown>> = {
	[K in keyof T as K extends `_${string}` ? K : `_${string & K}`]: T[K];
};

type Inversed<T extends Record<string, string | number>> = { [Key in keyof T as T[Key]]: Key };

export type { Overwrite, RequiredKeepUndefined, Underscored, Inversed };
