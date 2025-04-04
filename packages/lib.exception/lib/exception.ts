import { StringBuilder } from './StringBuilder.js';

interface SerializationContext {
	jsonStringifyReplacer?: (_: string, jsonVal: unknown) => unknown;
}

type Serializer = (value: unknown, stringBuilder: StringBuilder, indentation: string, seenErrors: WeakSet<Error>, context: SerializationContext) => boolean;

type ExceptionCause = Exception | Error | unknown;

class Exception extends Error {
	static readonly #PRIMITIVES_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		const typeofVal = typeof value;
		if (value == null || typeofVal === 'boolean' || typeofVal === 'number' || typeofVal === 'bigint') {
			stringBuilder.append(`${value}`);
			return true;
		}
		return false;
	};
	static readonly #STRING_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		if (typeof value === 'string') {
			stringBuilder.appendMultiple('"', value, '"');
			return true;
		}
		return false;
	};
	static readonly #SYMBOL_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		if (typeof value === 'symbol') {
			stringBuilder.append(value.toString());
			return true;
		}
		return false;
	};
	static readonly #DATE_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		if (value instanceof Date) {
			stringBuilder.append(value.toISOString());
			return true;
		}
		return false;
	};
	static readonly #ARRAY_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		if (Array.isArray(value)) {
			stringBuilder.append(JSON.stringify(value));
			return true;
		}
		return false;
	};
	static readonly #ERROR_SERIALIZER: Serializer = (value, stringBuilder, indentation, seenErrors): boolean => {
		if (value instanceof Error) {
			Exception.#stringifyError(stringBuilder, indentation, seenErrors, value);
			return true;
		}
		return false;
	};
	static readonly #SET_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		if (value instanceof Set) {
			Exception.#stringifySet(stringBuilder, value);
			return true;
		}
		return false;
	};
	static readonly #MAP_SERIALIZER: Serializer = (value, stringBuilder): boolean => {
		if (value instanceof Map) {
			Exception.#stringifyMap(stringBuilder, value);
			return true;
		}
		return false;
	};
	static readonly #OBJECT_SERIALIZER: Serializer = (value, stringBuilder, indentation, seenErrors, context): boolean => {
		if (context.jsonStringifyReplacer == null) {
			context.jsonStringifyReplacer = (_, jsonVal): unknown => {
				if (jsonVal instanceof Error) {
					const sbForJson = new StringBuilder();
					Exception.#stringifyError(sbForJson, indentation, seenErrors, jsonVal);
					return sbForJson.toString();
				}
				if (typeof jsonVal === 'bigint' || typeof jsonVal === 'symbol') {
					return jsonVal.toString();
				}
				if (jsonVal instanceof Set) {
					const sbForSet = new StringBuilder();
					Exception.#stringifySet(sbForSet, jsonVal);
					return sbForSet.toString();
				}
				if (jsonVal instanceof Map) {
					const sbForMap = new StringBuilder();
					Exception.#stringifyMap(sbForMap, jsonVal);
					return sbForMap.toString();
				}
				return jsonVal;
			};
		}

		stringBuilder.append(JSON.stringify(value, context.jsonStringifyReplacer, indentation.length + 4));
		return true;
	};

	static readonly #SERIALIZERS: readonly Serializer[] = Object.freeze([
		// the order here matters, we start with primitives, then builtin types that are "like-objects", then raw objects
		Exception.#PRIMITIVES_SERIALIZER,
		Exception.#STRING_SERIALIZER,
		Exception.#SYMBOL_SERIALIZER,
		Exception.#DATE_SERIALIZER,
		Exception.#ARRAY_SERIALIZER,
		Exception.#ERROR_SERIALIZER,
		Exception.#SET_SERIALIZER,
		Exception.#MAP_SERIALIZER,
		Exception.#OBJECT_SERIALIZER
	]);

	static readonly #ERROR_SERIALIZATION_SKIPPABLE_PROPERTIES: readonly (keyof Exception)[] = Object.freeze([
		'name',
		'message',
		'stack',
		'emitter',
		'code',
		'cause'
	]);

	public readonly emitter: string;

	public readonly code: string;

	public override readonly message: string;

	public override cause?: ExceptionCause;

	public constructor(emitter: string, code: string, message: string, cause?: ExceptionCause) {
		super(message);
		Error.captureStackTrace(this, Exception);
		Object.setPrototypeOf(this, new.target.prototype); // see https://stackoverflow.com/a/48342359

		this.name = this.constructor.name;
		this.message = message;
		this.emitter = emitter;
		this.code = code;
		this.cause = cause;
	}

	static {
		Object.freeze(Exception);
	}

	public override toString(): string {
		return Exception.stringify(this);
	}

	public static stringify(error: Error): string {
		const sb = new StringBuilder();
		const seenErrors = new WeakSet<Error>(); // handle circular refs in `cause` property
		const indentation = '';

		Exception.#stringifyError(sb, indentation, seenErrors, error);

		return sb.toString();
	}

	static #stringifyError(sb: StringBuilder, indentation: string, seenErrors: WeakSet<Error>, errorToStringify: Error): void {
		if (seenErrors.has(errorToStringify)) {
			return;
		}
		seenErrors.add(errorToStringify);

		if (errorToStringify.stack) {
			Exception.#stringifyStackTrace(sb, errorToStringify as Exception);
		} else {
			sb.appendMultiple(errorToStringify.name, ' ', errorToStringify.message);
		}

		const indentationForErrorProperties = `${indentation}    `;

		const serializationContext: SerializationContext = {};
		for (const prop in errorToStringify) {
			if (!Object.hasOwn(errorToStringify, prop) || Exception.#ERROR_SERIALIZATION_SKIPPABLE_PROPERTIES.includes(prop)) {
				continue; // We need to get skip them, cuz we added them already to string builder
			}

			Exception.#appendIndentedLine(sb, indentationForErrorProperties, prop);
			sb.append(': ');

			const val = errorToStringify[prop as keyof typeof errorToStringify];
			for (const serializer of Exception.#SERIALIZERS) {
				if (serializer(val, sb, indentationForErrorProperties, seenErrors, serializationContext)) {
					break;
				}
			}
		}

		if (errorToStringify.cause != null) {
			Exception.#unwindCausedBy(sb, indentation, seenErrors, errorToStringify.cause);
		}
	}

	static #unwindCausedBy(sb: StringBuilder, indentation: string, seenErrors: WeakSet<Error>, cause: ExceptionCause): void {
		if (seenErrors.has(cause as Error)) {
			return;
		}

		Exception.#appendIndentedLine(sb, indentation, 'Caused by: ');

		if (cause instanceof Error) {
			Exception.#stringifyError(sb, indentation, seenErrors, cause);
		} else {
			sb.append(JSON.stringify(cause));
		}
	}

	static #stringifyStackTrace(sb: StringBuilder, err: Exception): void {
		if (err.emitter) {
			sb.append(`(${err.emitter}) `);
		}
		if (err.code) {
			sb.append(`[${err.code}] `);
		}
		if (err.stack) {
			sb.append(err.stack);
		}
	}

	static #appendIndentedLine(sb: StringBuilder, indentation: string, value: string): void {
		sb.appendLine(indentation).append(value);
	}

	static #stringifySet<T>(sb: StringBuilder, set: Set<T>): void {
		sb.append('Set(');
		let delimiter = '';
		for (const item of set) {
			sb.appendMultiple(delimiter, JSON.stringify(item));
			delimiter = ', ';
		}
		sb.append(')');
	}

	static #stringifyMap<K, V>(sb: StringBuilder, map: Map<K, V>): void {
		sb.append('Map(');
		let delimiter = '';
		for (const entry of map.entries()) {
			sb.appendMultiple(delimiter, JSON.stringify(entry));
			delimiter = ', ';
		}
		sb.append(')');
	}
}

export { Exception };
