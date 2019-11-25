class Exception extends Error {
  constructor(emitter, code, message, data) {
    super(message);
    Error.captureStackTrace(this, Exception);

    this.name = this.constructor.name;
    this.emitter = emitter;
    this.code = code;
    this.data = data;
  }

  toString() {
    return `[${this.emitter}] ${this.code}: ${this.message}`;
  }
}

export default Exception;
export { Exception };
