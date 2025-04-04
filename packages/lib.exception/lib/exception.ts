/**
 * This class represents the logical errors detected by programmer and is thrown when one of them
 * occurs.
 */
class Exception extends Error {
	/** Module that emitted the {@link Exception}. */
	public readonly emitter: string;

	/** General error code that briefly explains error condition. */
	public readonly code: string;

	/** Error origin. Might contain a nested {@link Error} or additional data that caused this error. */
	public readonly origin?: any;

	/**
	 * @class
	 *
	 * @param emitter Exception emitter.
	 * @param code    Error code.
	 * @param message Error message.
	 * @param origin  Error origin.
	 */
	public constructor(emitter: string, code: string, message?: string, origin?: any) {
		super(message);
		Error.captureStackTrace(this, Exception);

		this.name = this.constructor.name;
		this.emitter = emitter;
		this.code = code;
		this.origin = origin;
	}

	/** Format {@link Exception} into string. */
	public override toString(): string {
		return `[${this.emitter}] ${this.code}: ${this.message}${this.origin ? ` :${JSON.stringify(this.origin)}` : ''}`;
	}
}

export { Exception };
