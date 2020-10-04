import { chai } from '@thermopylae/lib.unit-test';
import { describe, it, afterEach } from 'mocha';
import fs from 'fs';
import process from 'process';
import { FormattingManager } from '../lib/formatting-manager';
import { FileLogsManager } from '../lib/transports/file';
import { formatCurrentDate, expectToLogIntoFile, log, unlinkAsync } from './utils';

const { expect } = chai;

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
		for (let i = 0; i < createdFiles.length; i += 1) {
			if (fs.existsSync(createdFiles[i])) {
				promises.push(unlinkAsync(createdFiles[i]));
			}
		}
		await Promise.all(promises);
	});

	it('modules can log to same file with same minimum level', async () => {
		const filelogs = new FileLogsManager();
		const formatter = new FormattingManager();
		filelogs.createTransport(config);

		await log(formatter.formatterFor('module1'), filelogs.get()!, {
			level: 'info',
			message: 'info1'
		});
		await log(formatter.formatterFor('module2'), filelogs.get()!, {
			level: 'warn',
			message: 'warn2'
		});
		await log(formatter.formatterFor('module1'), filelogs.get()!, {
			level: 'silly',
			message: 'silly1'
		});
		await log(formatter.formatterFor('module2'), filelogs.get()!, {
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
});
