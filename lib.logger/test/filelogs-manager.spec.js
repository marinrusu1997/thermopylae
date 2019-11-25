import { describe, it, beforeEach, afterEach } from 'mocha';
import fs from 'fs';
import util from 'util';
import process from 'process';
import { chai } from './chai';
import { currentDate, expectToLog, log } from './utils';
import { FormattingManager } from '../lib/formatting/formatting-manager';
import { FileLogsManager } from '../lib/transports/filelogs-manager';

describe('Filelogs Manager spec', () => {
	const { expect } = chai;
	const config = {
		level: 'info',
		frequency: '1m',
		zippedArchive: true,
		filename: 'test',
		dirname: 'test',
		maxSize: '1k',
		maxFiles: 3,
		auditFile: 'test/audit.json',
		extension: '.log'
	};
	const unlink = util.promisify(fs.unlink);
	const createdFiles = [`test/${config.filename}.${process.pid}.${currentDate()}.log`, config.auditFile];
	let testCreatedFile = false;

	beforeEach(() => {
		config.filename = 'test';
	});

	afterEach(async () => {
		if (testCreatedFile) {
			const promises = [];
			for (let i = 0; i < createdFiles.length; i += 1) {
				promises.push(unlink(createdFiles[i]));
			}
			await Promise.all(promises);
			testCreatedFile = false;
		}
	});

	it('subsystems can log to same file with same minimum level', async () => {
		const filelogs = new FileLogsManager();
		const formatter = new FormattingManager();
		filelogs.setConfig(config);
		await log(formatter.formatterFor('system1'), filelogs.get('system1'), {
			level: 'info',
			message: 'info1'
		});
		await log(formatter.formatterFor('system2'), filelogs.get('system2'), {
			level: 'warn',
			message: 'warn2'
		});
		await log(formatter.formatterFor('system1'), filelogs.get('system1'), {
			level: 'silly',
			message: 'silly1'
		});
		await log(formatter.formatterFor('system2'), filelogs.get('system2'), {
			level: 'debug',
			message: 'debug2'
		});
		await expectToLog(
			createdFiles[0],
			[
				{
					level: 'info',
					system: 'system1',
					message: ' \tinfo1'
				},
				{
					level: 'warn',
					system: 'system2',
					message: ' \twarn2'
				}
			],
			['silly', 'debug']
		);
		testCreatedFile = true;
	});

	it('returns no file transport when not file config set', () => {
		expect(new FileLogsManager().get('blah')).to.be.equal(null);
	});
});
