/**
 * Pauses the invoking function for specified amount of milliseconds
 *
 * @param {number} ms Number of milliseconds
 * @return {Promise<any>}
 */
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Does safe validation for async tests using done callback
 *
 * @param {Function}  f     Function which contains assertions
 * @param {Function}  done  Mocha done callback
 */
function expectAsyncRes(f, done) {
	try {
		f();
		done();
	} catch (e) {
		done(e);
	}
}

export default {
	sleep,
	expectAsyncRes
};

export { sleep, expectAsyncRes };
