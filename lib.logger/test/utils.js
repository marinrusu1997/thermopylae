import winston from 'winston';
import fs from 'fs';
import util from 'util';
import { chai } from './chai';

const readFile = util.promisify(fs.readFile);
const { expect } = chai;
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
 * Calculates current date
 *
 * @returns {string} Current date in yyyy-mm-dd format
 */
function currentDate() {
	const today = new Date();
	const dd = String(today.getDate()).padStart(2, '0');
	const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
	const yyyy = today.getFullYear();
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * @typedef {{
 *   level: string,
 *   message: string
 * }} LogInfo
 */

/**
 * Logs a message using transport. Awaits logs to be delivered to destination.
 *
 * @param {Format}    format      Logs format
 * @param {object}    transport   Used transport
 * @param {LogInfo}   info        Logged info
 * @returns {Promise<void>}
 */
async function log(format, transport, info) {
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
 * @param {Format}    format      Logs format
 * @param {object}    transport   Used transport
 * @param {string}    message     Short description of the error.
 * @param {Array}     meta        Meta information about error.
 * @returns {Promise<void>}
 */
async function error(format, transport, message, ...meta) {
	winston
		.createLogger({
			format,
			transports: [transport]
		})
		.error(message, ...meta);
	await sleep(200);
}

/**
 * @typedef {{
 *   level: string,
 *   system: string,
 *   message: string
 * }} ExpectedLoggedInfo
 */
/**
 * Reads file content, and checks if logging was made correctly
 *
 * @param {string}                path      Path to file
 * @param {ExpectedLoggedInfo[]}  info      Expected info to be logged in specified order from array
 * @param {string[]}              notToLog  Array of terms which should not be logged
 * @throws {AssertionError} When invalid logging was made
 */
async function expectToLog(path, info, notToLog) {
	const regex = /^([^|]*) \[([^|]*)\] ([^|]*):(.*)$/;
	const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
	let matches;
	for (let i = 0; i < info.length; i += 1) {
		matches = regex.exec(lines[i]);
		expect(matches[2]).to.be.equal(info[i].system);
		expect(matches[3]).to.be.equal(info[i].level);
		expect(matches[4]).to.be.equal(info[i].message);
	}
	if (notToLog) {
		let termsNotToLog = '';
		for (let i = 0; i < notToLog.length; i += 1) {
			termsNotToLog = termsNotToLog.concat(notToLog[i]).concat('|');
		}
		termsNotToLog = termsNotToLog.slice(0, -1);
		const notToLogRegex = new RegExp(`^((?!${termsNotToLog}).)*$`);
		for (let i = 0; i < lines.length; i += 1) {
			expect(notToLogRegex.exec(lines[i])).to.not.be.equal(null);
		}
	}
}

export { sleep, currentDate, log, error, expectToLog };
