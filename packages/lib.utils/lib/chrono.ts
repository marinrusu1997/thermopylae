// @ts-expect-error-error - No typings
import unixTimestamp from '@darkwolf/unix-timestamp';
import type { AsyncFunction, ObjMap, SyncFunction, UnixTimestamp } from '@thermopylae/core.declarations';
import convertHrTime, { type HighResolutionTime } from 'convert-hrtime';
import process from 'node:process';

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
function executionTime<I, O>(fn: SyncFunction<I, O>, context?: ObjMap | null, ...args: I[]): TimedExecutionResult<O> {
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

/** @param options */
function unix(options?: { millis: boolean }): UnixTimestamp {
	return unixTimestamp(options);
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

export { executionTime, executionTimeAsync, firstDayOfNextMonth, tomorrow, unix };
export type { TimedExecutionResult };
