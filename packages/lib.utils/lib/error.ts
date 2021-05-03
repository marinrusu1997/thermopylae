function format(error: Error, exclude?: ReadonlyArray<string>, lineSeparator?: string): string {
	if (exclude == null) {
		exclude = format.EXCLUDE_NOTHING;
	}
	if (lineSeparator == null) {
		lineSeparator = '\n';
	}

	const formatted = new Array<string>();

	let value;
	for (const key of Object.getOwnPropertyNames(error)) {
		if (exclude.includes(key)) {
			continue;
		}

		value = (error as any)[key];

		if (value instanceof Error) {
			formatted.push(`${key}: ${value.message}`);
		} else {
			formatted.push(`${key}: ${JSON.stringify(value)}`);
		}
	}

	return formatted.join(lineSeparator);
}
format.EXCLUDE_NOTHING = Object.freeze([]) as readonly string[];
format.NO_STACK_TRACE = Object.freeze(['stack']);
format.NO_MESSAGE = Object.freeze(['message']);

export { format };
