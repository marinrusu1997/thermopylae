import fs from 'node:fs';
import { unlink } from 'node:fs/promises';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import type TransportStream from 'winston-transport';
import { FormattingManager, OutputFormat } from '../lib/formatting-manager.js';
import { FileLogsManager } from '../lib/transports/file.js';
import { expectToLogIntoFile, formatCurrentDate, log } from './utils.js';

describe(`${FileLogsManager.name} spec`, () => {
	const config = {
		level: 'info',
		frequency: '1m',
		zippedArchive: true,
		filename: 'test/log',
		dirname: 'test',
		maxSize: '1k',
		maxFiles: 3,
		auditFile: 'test/audit.json',
		extension: '.log'
	};
	const createdFiles = [`${config.filename}.${process.pid}.${formatCurrentDate()}.log`, config.auditFile];

	afterEach(async () => {
		const promises = [];
		for (const createdFile of createdFiles) {
			if (fs.existsSync(createdFile)) {
				promises.push(unlink(createdFile));
			}
		}
		await Promise.all(promises);
	});

	it('modules can log to same file with same minimum level', async () => {
		const fileLogs = new FileLogsManager();
		const formatter = new FormattingManager();

		formatter.setDefaultFormattingOrder(OutputFormat.PRINTF);
		fileLogs.createTransport(config);

		await log(formatter.formatterFor('module1'), fileLogs.get() as TransportStream, {
			level: 'info',
			message: 'info1'
		});
		await log(formatter.formatterFor('module2'), fileLogs.get() as TransportStream, {
			level: 'warn',
			message: 'warn2'
		});
		await log(formatter.formatterFor('module1'), fileLogs.get() as TransportStream, {
			level: 'silly',
			message: 'silly1'
		});
		await log(formatter.formatterFor('module2'), fileLogs.get() as TransportStream, {
			level: 'debug',
			message: 'debug2'
		});
		await expectToLogIntoFile(
			createdFiles[0],
			[
				{
					level: 'info',
					module: 'module1',
					message: '\tinfo1'
				},
				{
					level: 'warn',
					module: 'module2',
					message: '\twarn2'
				}
			],
			['silly', 'debug']
		);
	});

	it('returns no file transport when not file config set', () => {
		expect(new FileLogsManager().get()).to.be.equal(null);
	});

	it('creates transport only once', () => {
		const filelogs = new FileLogsManager();
		filelogs.createTransport(config);
		expect(() => filelogs.createTransport(config)).to.throw('Transport has been created already.');
	});
});
