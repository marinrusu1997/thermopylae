/**
 * Constant used to specify that key will never expire.
 */
const INFINITE_EXPIRATION = 0;

/**
 * @internal
 */
const NOT_FOUND_VALUE = undefined;

/**
 * @internal
 */
const EXPIRES_AT_SYM = Symbol.for('EXPIRES_AT_SYM');

export { INFINITE_EXPIRATION, NOT_FOUND_VALUE, EXPIRES_AT_SYM };
