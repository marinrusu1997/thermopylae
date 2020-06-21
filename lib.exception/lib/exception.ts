class Exception extends Error {
	public readonly emitter: string;

	public readonly code: string;

	public readonly cause?: any;

	constructor(emitter: string, code: string, message?: string, cause?: any) {
		super(message);
		Error.captureStackTrace(this, Exception);

		this.name = this.constructor.name;
		this.emitter = emitter;
		this.code = code;
		this.cause = cause;
	}

	public toString(): string {
		return `[${this.emitter}] ${this.code}: ${this.message}`;
	}
}

export { Exception };
