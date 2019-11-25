/**
 * Sleeps for specified amount of milliseconds
 *
 * @param {number} ms
 *
 * @return {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns current time in seconds
 *
 * @returns {number}
 */
function nowInSeconds(): number {
	return Math.floor(new Date().getTime() / 1000);
}

export { nowInSeconds, sleep };
