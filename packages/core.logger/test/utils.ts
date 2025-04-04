import type { Format } from 'logform';
import moment from 'moment';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { expect } from 'vitest';
import winston from 'winston';
import type TransportStream from 'winston-transport';

interface LoggedInfo {
	level: string;
	message: string;
}

interface ExpectedLoggedInfo {
	level: string;
	module: string;
	message: string;
}

function formatCurrentDate(): string {
	return moment().format('YYYY-MM-DD');
}

/**
 * Logs a message using transport. Awaits logs to be delivered to destination.
 *
 * @param format    Logs format.
 * @param transport Used transport.
 * @param info      Logged info.
 */
async function log(format: Format, transport: TransportStream, info: LoggedInfo): Promise<void> {
	winston
		.createLogger({
			format,
			transports: [transport]
		})
		.log(info);
	await sleep(200);
}

/**
 * Logs a error using transport. Await log to be delivered to destination.
 *
 * @param format    Logs format.
 * @param transport Used transport.
 * @param message   Short description of the error.
 * @param meta      Meta information about error.
 */
async function logError(format: Format, transport: TransportStream, message: string, ...meta: unknown[]): Promise<void> {
	winston
		.createLogger({
			format,
			transports: [transport]
		})
		.error(message, ...meta);
	await sleep(200);
}

/**
 * Reads file content, and checks if logging was made correctly.
 *
 * @param path     Path to file.
 * @param info     Expected info to be logged in specified order from array.
 * @param notToLog Array of terms which should not be logged.
 */
async function expectToLogIntoFile(path: string, info: ExpectedLoggedInfo[], notToLog: string[]): Promise<void> {
	const regex = /^([^|]*) \[([^|]*)\] ([^|]*):(.*)$/;
	const lines = (await readFile(path, 'utf8')).split(/\r?\n/);

	for (let i = 0; i < info.length; i++) {
		const matches = regex.exec(lines[i]);
		if (matches == null) {
			throw new Error(`Line ${i} does not match log format regex ${regex.source}.`);
		}

		expect(matches[2]).to.be.equal(info[i].module);
		expect(matches[3]).to.be.equal(info[i].level);
		expect(matches[4]).to.be.equal(info[i].message);
	}

	if (notToLog) {
		let termsNotToLog = '';
		for (const term of notToLog) {
			termsNotToLog += term;
			termsNotToLog += '|';
		}
		termsNotToLog = termsNotToLog.slice(0, -1);

		const notToLogRegex = new RegExp(`^((?!${termsNotToLog}).)*$`);
		for (const line of lines) {
			expect(notToLogRegex.exec(line)).to.not.be.equal(null);
		}
	}
}

export { formatCurrentDate, log, logError, expectToLogIntoFile };
