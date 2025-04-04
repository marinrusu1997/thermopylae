import type { AsyncFunction, Hours, Milliseconds, Minutes, ObjMap, Seconds, SyncFunction } from '@thermopylae/core.declarations';
import convertHrTime from 'convert-hrtime';
import type { HighResolutionTime } from 'convert-hrtime';
import process from 'process';

/**
 * Represent the result of the function which execution time was measured.
 *
 * @template R Function return type.
 */
interface TimedExecutionResult<R> {
	/** Function result. */
	result: R;
	/** Function execution high resolution time. */
	time: HighResolutionTime;
}

/**
 * Sleeps for specified amount of milliseconds.
 *
 * @param   {number}        ms Number of milliseconds to sleep.
 *
 * @returns {Promise<void>}
 */
function sleep(ms: Milliseconds): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Measure execution time of the given function.
 *
 * @template I Function arguments type.
 * @template O Function output type.
 *
 * @param   fn      Function instance.
 * @param   context Function calling context (i.e. `this`).
 * @param   args    Function arguments.
 *
 * @returns         Function result and it's execution time.
 */
function executionTime<I, O>(fn: SyncFunction<I, O>, context?: ObjMap, ...args: I[]): TimedExecutionResult<O> {
	const start = process.hrtime.bigint();
	const result = fn.apply(context, args);
	const time = convertHrTime(process.hrtime.bigint() - start); // do not count object construction time from bellow statement
	return { result, time };
}

/**
 * Measure execution time of the given async function.
 *
 * @template I Function arguments type.
 * @template O Function output type.
 *
 * @param   fn      Async function instance.
 * @param   context Function calling context (i.e. `this`).
 * @param   args    Function arguments.
 *
 * @returns         Function result and it's execution time.
 */
async function executionTimeAsync<I, O>(fn: AsyncFunction<I, O>, context?: ObjMap, ...args: I[]): Promise<TimedExecutionResult<O>> {
	const start = process.hrtime.bigint();
	const result = await fn.apply(context, args);
	const time = convertHrTime(process.hrtime.bigint() - start); // do not count object construction time from bellow statement
	return { result, time };
}

/**
 * Converts minutes to seconds.
 *
 * @param minutes
 */
function minutesToSeconds(minutes: Minutes): Seconds {
	return minutes * 60;
}

/**
 * Converts milliseconds to seconds.
 *
 * @param ms
 */
function millisecondsToSeconds(ms: Milliseconds): Seconds {
	return Math.floor(ms / 1000);
}

/**
 * Converts seconds to milliseconds.
 *
 * @param seconds
 */
function secondsToMilliseconds(seconds: Seconds): Milliseconds {
	return seconds * 1000;
}

/**
 * Convert hours, minutes and seconds to milliseconds.
 *
 * @param   hours   Number of hours. <br/> Defaults to **0**.
 * @param   minutes Number of minutes. <br/> Defaults to **0**.
 * @param   seconds Number of seconds. <br/> Defaults to **0**.
 *
 * @returns         Number of milliseconds.
 */
function milliseconds(hours: Hours = 0, minutes: Minutes = 0, seconds: Seconds = 0): Milliseconds {
	return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Convert given `date` to UNIX time.
 *
 * @param   date Date to be converted.
 *
 * @returns      UNIX time equivalent of the `date`.
 */
function unixTime(date = new Date()): Seconds {
	return millisecondsToSeconds(date.getTime());
}

/**
 * Converts given UNIX time to Date equivalent.
 *
 * @param   elapsed UNIX time.
 *
 * @returns         Date equivalent.
 */
function fromUnixTime(elapsed: Seconds): Date {
	return new Date(secondsToMilliseconds(elapsed));
}

/**
 * Computes the date for next month at midnight time.
 *
 * @returns Date of first day for next month.
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
 *
 * @returns Date of tomorrow.
 */
function tomorrow(): Date {
	// see https://stackoverflow.com/questions/23081158/javascript-get-date-of-the-next-day/23081260
	const tomorrowDate = new Date();
	tomorrowDate.setDate(new Date().getDate() + 1);
	return tomorrowDate;
}

export {
	sleep,
	executionTime,
	executionTimeAsync,
	milliseconds,
	unixTime,
	fromUnixTime,
	minutesToSeconds,
	millisecondsToSeconds,
	secondsToMilliseconds,
	firstDayOfNextMonth,
	tomorrow
};
export type { TimedExecutionResult };
