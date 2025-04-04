type IsCamelCase<S extends string> = S extends `${infer First}${infer Rest}`
	? First extends Lowercase<First> // First character must be lowercase
		? Rest extends Capitalize<Rest> // Rest must start with uppercase
			? true
			: IsCamelCase<Rest> // Continue checking the rest
		: false
	: false;

export type { IsCamelCase };
