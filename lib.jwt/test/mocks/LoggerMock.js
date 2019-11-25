import { chai } from '../chai';

const { expect } = chai;

/** Mocks the Logger instance used by Jwt Auth Strategies */
class LoggerMock {
	constructor() {
		this.reset();
	}

	/**
	 * Use this method to reset state of the mock.
	 * Can be invoked before test case.
	 * Default values are null.
	 */
	reset() {
		this.err = null;
		this.msg = null;
	}

	/**
	 * Mocks the log method
	 *
	 * @param {Error}   err   Error occurred during operation
	 * @param {string}  msg   Error detailed message
	 */
	error(err, msg) {
		this.err = err;
		this.msg = msg;
	}

	/**
	 * Mocks the info method
	 *
	 * @param {string}  msg   Some info message about operation execution status
	 */
	info(msg) {
		this.msg = msg;
	}

	/**
	 * @typedef {{
	 *   err: Error,
	 *   msg: string
	 * }} LoggerExpectedResult
	 */

	/**
	 * After all operations were made, check their status with the expected result
	 * After expect is made, state is reset to default values.
	 *
	 * @param {LoggerExpectedResult}  result  Expected operations result
	 */
	expect(result) {
		expect(this.err).to.be.equal(result.err);
		expect(this.msg).to.be.equal(result.msg);
		this.reset();
	}
}

export default LoggerMock;
export { LoggerMock };
