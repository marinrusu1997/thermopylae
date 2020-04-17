import { chai } from '../chai';

const { expect } = chai;

/** Mocks the Express Response object */
class ResponseMock {
	constructor() {
		this.reset();
	}

	/**
	 * Resets the mock instance to default values.
	 * Use this before new test case.
	 * Default values are null.
	 */
	reset() {
		this.statusCode = null;
		this.msg = null;
	}

	/**
	 * Mock the status method
	 *
	 * @param {number}  status HTTP Status Code
	 * @returns {ResponseMock} Methods can be chained
	 */
	status(status) {
		this.statusCode = status;
		return this;
	}

	/**
	 * Mock the send method
	 * @param {string}  message   Message sent to client
	 * @returns {ResponseMock}    Methods can be chained
	 */
	send(message) {
		this.msg = message;
		return this;
	}

	/**
	 * @typedef {{
	 *   statusCode: number,
	 *   msg: string
	 * }} ExpressResponseExpectedResult
	 */

	/**
	 * After all operations were made, check their status with the expected result.
	 * After expect is made, state is reset to default values.
	 *
	 * @param {ExpressResponseExpectedResult}  result  Expected operations result
	 */
	expect(result) {
		expect(this.statusCode).to.be.equal(result.statusCode);
		expect(this.msg).to.be.equal(result.msg);
		this.reset();
	}
}

export default ResponseMock;
export { ResponseMock };
