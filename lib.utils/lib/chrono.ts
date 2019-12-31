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

/**
 * Returns JS Date from seconds timestamp
 *
 * @param {number}	seconds
 */
function dateFromSeconds(seconds: number): Date {
	return new Date(seconds * 1000);
}

/**
 * Converts minutes to seconds.
 *
 * @param minutes
 */
function minutesToSeconds(minutes: number): number {
	return minutes * 60;
}

export { nowInSeconds, sleep, dateFromSeconds, minutesToSeconds };
