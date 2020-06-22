import { createException, ErrorCodes } from '../error';

class StructuredKey {
	private readonly scope?: string;

	private readonly namespace?: string;

	private readonly id: string;

	private static readonly DELIMITER = ':';

	constructor(id: string, namespace?: string, scope?: string) {
		this.scope = scope;
		this.namespace = namespace;
		this.id = id;
	}

	public toString(): string {
		return StructuredKey.toString(this.id, this.namespace, this.scope);
	}

	public static toString(id: string, namespace?: string, scope?: string): string {
		const keyParts: Array<string> = [];

		if (scope) {
			StructuredKey.assertNotContainsDelimiter(scope);
			keyParts.push(scope);
		}

		if (namespace) {
			StructuredKey.assertNotContainsDelimiter(namespace);
			keyParts.push(namespace);
		}

		StructuredKey.assertNotContainsDelimiter(id);
		keyParts.push(id);

		return keyParts.join(StructuredKey.DELIMITER);
	}

	public static fromString(key: string): StructuredKey {
		const keyParts = key.split(StructuredKey.DELIMITER);
		switch (keyParts.length) {
			case 1:
				return new StructuredKey(keyParts[0]);
			case 2:
				return new StructuredKey(keyParts[1], keyParts[0]);
			case 3:
				return new StructuredKey(keyParts[2], keyParts[1], keyParts[0]);
			default:
				throw createException(ErrorCodes.INVALID_KEY_PART, `Number of key parts must not overcome 3. Extracted: ${keyParts.length} parts.`);
		}
	}

	private static assertNotContainsDelimiter(keyPart: string): void {
		if (keyPart.includes(StructuredKey.DELIMITER)) {
			throw createException(ErrorCodes.INVALID_KEY_PART, `Key part is not allowed to contain ${StructuredKey.DELIMITER}`);
		}
	}
}

export { StructuredKey };
