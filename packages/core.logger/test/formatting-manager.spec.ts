import type { types } from '@thermopylae/lib.utils';
import type { TransformableInfo } from 'logform';
import { describe, expect, it } from 'vitest';
import { format } from 'winston';
import type { SyslogConfigSetLevels } from 'winston/lib/winston/config/index.js';
import { DefaultFormatters, FormattingManager, OutputFormat } from '../lib/formatting-manager.js';

// oxlint-disable-next-line no-disabled-tests
describe.skip(`${FormattingManager.name} spec`, () => {
	describe(`${FormattingManager.prototype.setDefaultFormattingOrder.name} spec`, () => {
		it('throws when invalid output specified', () => {
			const formattingManager = new FormattingManager();
			expect(() => formattingManager.setDefaultFormattingOrder('INVALID FOR SURE' as OutputFormat)).to.throw('Unknown output format: INVALID FOR SURE.');
		});

		it('applies order for uncolored printf', () => {
			const formattingManager = new FormattingManager();
			formattingManager.setDefaultFormattingOrder(OutputFormat.PRINTF);

			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message } as types.Any;
			info[Symbol.for('level')] = level;

			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info) as TransformableInfo;
			expect(loggedInfo.level).to.equal(level);
			expect(loggedInfo.message).to.equal(`\t${message}`);
			// @ts-expect-error  For testing purposesrposes
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo['label']).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(`${loggedInfo.timestamp} [${loggedInfo.label}] ${level}: \t${message}`);
		});

		it('applies order for colored printf', () => {
			const formattingManager = new FormattingManager();
			formattingManager.setDefaultFormattingOrder(OutputFormat.PRINTF, { colorize: true });

			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message } as types.Any;
			info[Symbol.for('level')] = level;

			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info) as TransformableInfo;
			expect(loggedInfo.level).to.equal(`\u001B[32m${level}\u001B[39m`);
			expect(loggedInfo.message).to.equal(`\u001B[32m\t${message}\u001B[39m`);
			// @ts-expect-error  For testing purposesrposes
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo['label']).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				`${loggedInfo['timestamp']} [${loggedInfo['label']}] \u001B[32m${level}\u001B[39m: \u001B[32m	${message}\u001B[39m`
			);
		});

		it('applies order for uncolored json', () => {
			const formattingManager = new FormattingManager();
			formattingManager.setDefaultFormattingOrder(OutputFormat.JSON);

			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };

			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info) as TransformableInfo;
			expect(loggedInfo.level).to.equal(level);
			expect(loggedInfo.message).to.equal(`\t${message}`);
			// @ts-expect-error  For testing purposesrposes
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo['label']).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				JSON.stringify(
					{
						level,
						message: `\t${message}`,
						label: SUBSYSTEM,
						timestamp: loggedInfo['timestamp']
					},
					null,
					4
				)
			);
		});

		it('applies order for colored json', () => {
			const formattingManager = new FormattingManager();
			formattingManager.setDefaultFormattingOrder(OutputFormat.JSON, { colorize: true });

			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			// @ts-expect-error  For testing purposesrposes
			info[Symbol.for('level')] = level;

			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info) as TransformableInfo;
			expect(loggedInfo.level).to.equal(`\u001B[32m${level}\u001B[39m`);
			expect(loggedInfo.message).to.equal(`\u001B[32m\t${message}\u001B[39m`);
			// @ts-expect-error  For testing purposesrposes
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo['label']).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				JSON.stringify(
					{
						level: `\u001B[32m${level}\u001B[39m`,
						message: `\u001B[32m\t${message}\u001B[39m`,
						label: SUBSYSTEM,
						timestamp: loggedInfo['timestamp']
					},
					null,
					4
				)
			);
		});

		it('applies order for uncolored pretty print', () => {
			const formattingManager = new FormattingManager();
			formattingManager.setDefaultFormattingOrder(OutputFormat.PRETTY_PRINT);

			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };

			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info) as TransformableInfo;
			expect(loggedInfo.level).to.equal(level);
			expect(loggedInfo.message).to.equal(`\t${message}`);
			// @ts-expect-error  For testing purposesrposes
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo['label']).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				`{\n  level: '${level}',\n  message: '\\t${message}',\n  label: '${SUBSYSTEM}',\n  timestamp: '${loggedInfo['timestamp']}'\n}`
			);
		});

		it('applies order for colored pretty print', () => {
			const formattingManager = new FormattingManager();
			formattingManager.setDefaultFormattingOrder(OutputFormat.PRETTY_PRINT, { colorize: true });

			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			// @ts-expect-error  For testing purposesrposes
			info[Symbol.for('level')] = level;

			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info) as TransformableInfo;
			expect(loggedInfo.level).to.equal(`\u001B[32m${level}\u001B[39m`);
			expect(loggedInfo.message).to.equal(`\u001B[32m\t${message}\u001B[39m`);
			// @ts-expect-error  For testing purposesrposes
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo['label']).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				`{\n  level: '\\u001b[32m${level}\\u001b[39m',\n  message: '\\u001b[32m\\t${message}\\u001b[39m',\n  label: 'SUBSYSTEM',\n  timestamp: '${loggedInfo['timestamp']}'\n}`
			);
		});
	});

	describe(`${FormattingManager.prototype.formatterFor.name} spec`, () => {
		it('throws when no recipe is registered', () => {
			const formattingManager = new FormattingManager();
			formattingManager.removeFormatter('align');
			expect(() => formattingManager.formatterFor('SUBSYSTEM')).to.throw('Order recipe is not configured');
		});

		it('throws when formatter from the recipe is not registered', () => {
			const formattingManager = new FormattingManager();
			formattingManager.removeFormatter('align');
			formattingManager.setCustomFormattingOrder(['not existing formatter']);
			expect(() => formattingManager.formatterFor('SUBSYSTEM')).to.throw("Formatter 'not existing formatter' from the recipe is not registered");
		});
	});

	it('creates an instance with predefined formatters and recipe', () => {
		const formattingManager = new FormattingManager();
		const SUBSYSTEM = 'SUBSYSTEM';
		let level: keyof SyslogConfigSetLevels = 'info';
		let loggedInfo: TransformableInfo | null = null;

		/* message formatting */
		const message = 'message';
		loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform({
			level,
			message
		}) as TransformableInfo;

		expect(loggedInfo.level).to.equal(level);
		expect(loggedInfo.message).to.equal(`\t${message}`);
		// @ts-expect-error  For testing purposesrposes
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo['label']).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for(message)]).to.equal(`${loggedInfo.timestamp} (${process.pid}) [${loggedInfo.label}] ${loggedInfo.level}:\t${message}`);

		/* error formatting */
		level = 'err';
		const err = new Error(message);
		loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform({
			level,
			message: err as types.Any
		}) as TransformableInfo;

		expect(loggedInfo.level).to.equal(level);
		expect(loggedInfo.message).to.equal(`\t${err.message}`);
		// @ts-expect-error  For testing purposesrposes
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo['label']).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for(message)]).to.equal(
			`${loggedInfo['timestamp']} (${process.pid}) [${loggedInfo['label']}] ${loggedInfo.level}:\t${err.message}\n${err.stack}`
		);
	});

	it('adds new formatter, then if exists overwrites, then discards recipe', () => {
		const formattingManager1 = new FormattingManager();
		const SUBSYSTEM = 'SUBSYSTEM';
		const logLevel = 'info';
		const logMessage = 'message';
		let loggedInfo: TransformableInfo | null = null;

		/* overwrite existing one */
		formattingManager1.setFormatter(
			DefaultFormatters.PRINTF,
			format.printf(({ level, label, timestamp }) => `${timestamp} [${label}] ${level}`)
		);

		/* recipe must be invalidated */
		expect(() => formattingManager1.formatterFor(SUBSYSTEM)).to.throw('Order recipe is not configured');
		formattingManager1.setCustomFormattingOrder(['timestamp', 'errors', 'splat', 'align', 'printf']);

		/* assert existing was overwritten */
		loggedInfo = formattingManager1.formatterFor(SUBSYSTEM).transform({
			level: logLevel,
			message: logMessage
		}) as TransformableInfo;

		expect(loggedInfo.level).to.equal(logLevel);
		expect(loggedInfo.message).to.equal(`\t${logMessage}`);
		// @ts-expect-error  For testing purposesrposes
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo['label']).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for('message')]).to.equal(`${loggedInfo.timestamp} [${loggedInfo.label}] ${loggedInfo.level}`);

		/* add new formatter */
		const formattingManager2 = new FormattingManager();
		formattingManager2.setFormatter(DefaultFormatters.JSON, format.json({ space: 4 }));
		formattingManager2.setCustomFormattingOrder(['timestamp', 'errors', 'splat', 'json']);
		loggedInfo = formattingManager2.formatterFor(SUBSYSTEM).transform({
			level: logLevel,
			message: logMessage
		}) as TransformableInfo;

		expect(loggedInfo.level).to.equal(logLevel);
		expect(loggedInfo.message).to.equal(`${logMessage}`);
		// @ts-expect-error  For testing purposesrposes
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo['label']).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for('message')]).to.equal(
			JSON.stringify(
				{
					level: logLevel,
					message: logMessage,
					label: SUBSYSTEM,
					timestamp: loggedInfo['timestamp']
				},
				null,
				4
			)
		);
	});

	it('removes formatter', () => {
		const formattingManager = new FormattingManager();
		formattingManager.removeFormatter('align');
		const SUBSYSTEM = 'SUBSYSTEM';
		const level = 'info';
		const message = 'message';
		formattingManager.setCustomFormattingOrder(['timestamp', 'errors', 'splat', 'printf']);

		const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform({
			level,
			message
		}) as TransformableInfo;

		expect(loggedInfo.level).to.equal(level);
		expect(loggedInfo.message).to.equal(message);
		// @ts-expect-error  For testing purposesrposes
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo['label']).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for(message)]).to.equal(`${loggedInfo.timestamp} (${process.pid}) [${loggedInfo.label}] ${loggedInfo.level}: ${message}`);
	});

	it('order throws when recipe was defined already', () => {
		const formattingManager = new FormattingManager();
		expect(() => formattingManager.setCustomFormattingOrder(['foo formatter'])).to.throw('Order recipe configured already.');
	});
});
