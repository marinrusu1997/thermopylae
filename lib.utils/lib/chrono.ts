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
 * Returns given time in seconds
 *
 * @returns {number}
 */
function dateToUNIX(date = new Date()): number {
	return Math.floor(date.getTime() / 1000);
}

/**
 * Returns JS Date from seconds timestamp
 *
 * @param {number}	seconds
 */
function dateFromUNIX(seconds: number): Date {
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

/**
 * Computes the date for next month at midnight time.
 */
function firstDayOfNextMonth(): Date {
	const now = new Date();
	const currentMonth = now.getMonth();
	const currentYear = now.getFullYear();

	const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1; // for december, go to january
	const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

	return new Date(nextYear, nextMonth, 2);
}

/**
 * Computes the date of tomorrow. Tomorrow computation will have current time.
 */
function tomorrow(): Date {
	// see https://stackoverflow.com/questions/23081158/javascript-get-date-of-the-next-day/23081260
	const tomorrowDate = new Date();
	tomorrowDate.setDate(new Date().getDate() + 1);
	return tomorrowDate;
}

export { dateToUNIX, sleep, dateFromUNIX, minutesToSeconds, firstDayOfNextMonth, tomorrow };
