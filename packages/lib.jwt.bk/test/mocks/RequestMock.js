import set from 'lodash.set';

class RequestMock {
	constructor() {
		this.reset();
	}

	/**
	 * Resets the state of request to defaults.
	 * Defaults are empty objects for headers, query, body, cookies
	 */
	reset() {
		this.headers = {};
		this.query = {};
		this.body = {};
		this.cookies = {};
	}

	/**
	 * Sets a header and his associated value.
	 * Lodash set is used internally.
	 *
	 * @param {string}  name  Path to header name
	 * @param           value Value of that header
	 */
	setHeader(name, value) {
		set(this.headers, name, value);
	}

	/**
	 * Sets a query param and his associated value.
	 *
	 * @param {string}  name  Path to cookie
	 * @param           value Value of the cookie
	 */
	setQuery(name, value) {
		set(this.query, name, value);
	}

	/**
	 * Sets the body param and his associated value.
	 *
	 * @param {string}  name  Path to body param
	 * @param           value Value of the body param
	 */
	setBody(name, value) {
		set(this.body, name, value);
	}

	/**
	 * Sets the cookie param and his associated value.
	 *
	 * @param {string}  name  Path to cookie param
	 * @param           value Value of the cookie param
	 */
	setCookie(name, value) {
		set(this.cookies, name, value);
	}
}

export default RequestMock;
export { RequestMock };
