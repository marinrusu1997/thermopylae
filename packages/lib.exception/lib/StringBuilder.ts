class StringBuilder {
	readonly #tokens: string[];

	public constructor() {
		this.#tokens = [];
		Object.freeze(this);
	}

	public append(value: string): StringBuilder {
		this.#tokens.push(value);
		return this;
	}

	public appendMultiple(...values: string[]): StringBuilder {
		this.#tokens.push(...values);
		return this;
	}

	public appendLine(value: string): StringBuilder {
		this.#tokens.push('\n', value);
		return this;
	}

	public toString(): string {
		return this.#tokens.join('');
	}

	public clear(): void {
		this.#tokens.length = 0;
	}
}

export { StringBuilder };
