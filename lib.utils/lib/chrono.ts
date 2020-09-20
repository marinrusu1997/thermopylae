import { AsyncFunction, Milliseconds, Minutes, Seconds, SyncFunction } from '@thermopylae/core.declarations';
import convertHrTime, { HRTime } from 'convert-hrtime';
import process from 'process';

/**
 * Represent the result of the function which execution time was measured.
 *
 * @template R	Function return type.
 */
interface TimedExecutionResult<R> {
	/**
	 * Function result.
	 */
	result: R;
	/**
	 * Function execution high resolution time.
	 */
	time: HRTime;
}

/**
 * Sleeps for specified amount of milliseconds
 *
 * @param {number} ms	Number of milliseconds to sleep.
 *
 * @return {Promise<void>}
 */
function sleep(ms: Milliseconds): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measure execution time of the given function.
 *
 * @template I	Function arguments type.
 * @template O	Function output type.
 *
 * @param fn		Function instance.
 * @param context	Function calling context (i.e. `this`).
 * @param args		Function arguments.
 *
 * @returns		Function result and it's execution time.
 */
function executionTime<I, O>(fn: SyncFunction<I, O>, context?: any, ...args: I[]): TimedExecutionResult<O> {
	const start = process.hrtime();
	const result = fn.apply(context, args);
	const time = convertHrTime(process.hrtime(start)); // do not count object construction time from bellow statement
	return { result, time };
}

/**
 * Measure execution time of the given async function.
 *
 * @template I	Function arguments type.
 * @template O	Function output type.
 *
 * @param fn		Async function instance.
 * @param context	Function calling context (i.e. `this`).
 * @param args		Function arguments.
 *
 * @returns		Function result and it's execution time.
 */
async function executionTimeAsync<I, O>(fn: AsyncFunction<I, O>, context?: any, ...args: I[]): Promise<TimedExecutionResult<O>> {
	const start = process.hrtime();
	const result = await fn.apply(context, args);
	const time = convertHrTime(process.hrtime(start)); // do not count object construction time from bellow statement
	return { result, time };
}

/**
 * Returns given time in seconds
 *
 * @returns {number}
 */
function dateToUNIX(date = new Date()): number {
	return millisecondsToSeconds(date.getTime());
}

/**
 * Returns JS Date from seconds timestamp
 *
 * @param {number}	seconds
 */
function dateFromUNIX(seconds: Seconds): Date {
	return new Date(seconds * 1000);
}

/**
 * Converts minutes to seconds.
 *
 * @param minutes
 */
function minutesToSeconds(minutes: Minutes): number {
	return minutes * 60;
}

/**
 * Converts seconds to milliseconds.
 *
 * @param milliseconds
 */
function millisecondsToSeconds(milliseconds: Milliseconds): number {
	return Math.floor(milliseconds / 1000);
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

export {
	TimedExecutionResult,
	sleep,
	executionTime,
	executionTimeAsync,
	dateToUNIX,
	dateFromUNIX,
	minutesToSeconds,
	millisecondsToSeconds,
	firstDayOfNextMonth,
	tomorrow
};
