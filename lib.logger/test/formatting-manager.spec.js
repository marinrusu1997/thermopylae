import { describe, it } from 'mocha';
import { format } from 'winston';
import { chai } from './chai';
import { FormattingManager } from '../lib/formatting/formatting-manager';

describe('Formatting manager spec', () => {
	const { expect } = chai;

	describe('default orders spec', () => {
		it('throws when invalid output specified', () => {
			const formattingManager = new FormattingManager();
			expect(() => formattingManager.applyOrderFor('INVALID FOR SURE')).to.throw('Invalid output format');
		});

		it('applies order for uncolored printf', () => {
			const formattingManager = new FormattingManager();
			formattingManager.applyOrderFor('PRINTF');
			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			info[Symbol.for('level')] = level;
			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info);
			expect(loggedInfo.level).to.equal(level);
			expect(loggedInfo.message).to.equal(`\t${message}`);
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo.label).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				`${loggedInfo.timestamp} [${loggedInfo.label}] ${level}: \t${message}`
			);
		});

		it('applies order for colored printf', () => {
			const formattingManager = new FormattingManager();
			formattingManager.applyOrderFor('PRINTF', true);
			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			info[Symbol.for('level')] = level;
			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info);
			expect(loggedInfo.level).to.equal(`\u001b[32m${level}\u001b[39m`);
			expect(loggedInfo.message).to.equal(`\u001b[32m\t${message}\u001b[39m`);
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo.label).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				`${loggedInfo.timestamp} [${loggedInfo.label}] \u001b[32m${level}\u001b[39m: \u001b[32m	${message}\u001b[39m`
			);
		});

		it('applies order for uncolored json', () => {
			const formattingManager = new FormattingManager();
			formattingManager.applyOrderFor('JSON');
			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info);
			expect(loggedInfo.level).to.equal(level);
			expect(loggedInfo.message).to.equal(`\t${message}`);
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo.label).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				JSON.stringify(
					{
						level,
						message: `\t${message}`,
						label: SUBSYSTEM,
						timestamp: loggedInfo.timestamp
					},
					null,
					4
				)
			);
		});

		it('applies order for colored json', () => {
			const formattingManager = new FormattingManager();
			formattingManager.applyOrderFor('JSON', true);
			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			info[Symbol.for('level')] = level;
			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info);
			expect(loggedInfo.level).to.equal(`\u001b[32m${level}\u001b[39m`);
			expect(loggedInfo.message).to.equal(`\u001b[32m\t${message}\u001b[39m`);
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo.label).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				JSON.stringify(
					{
						level: `\u001b[32m${level}\u001b[39m`,
						message: `\u001b[32m\t${message}\u001b[39m`,
						label: SUBSYSTEM,
						timestamp: loggedInfo.timestamp
					},
					null,
					4
				)
			);
		});

		it('applies order for uncolored pretty print', () => {
			const formattingManager = new FormattingManager();
			formattingManager.applyOrderFor('PRETTY_PRINT');
			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info);
			expect(loggedInfo.level).to.equal(level);
			expect(loggedInfo.message).to.equal(`\t${message}`);
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo.label).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				// eslint-disable-next-line no-useless-escape
				`{\n  level: \'${level}\',\n  message: \'\\t${message}\',\n  label: \'${SUBSYSTEM}\',\n  timestamp: \'${loggedInfo.timestamp}\'\n}`
			);
		});

		it('applies order for colored pretty print', () => {
			const formattingManager = new FormattingManager();
			formattingManager.applyOrderFor('PRETTY_PRINT', true);
			const SUBSYSTEM = 'SUBSYSTEM';
			const level = 'info';
			const message = 'message';
			const info = { level, message };
			info[Symbol.for('level')] = level;
			const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform(info);
			expect(loggedInfo.level).to.equal(`\u001b[32m${level}\u001b[39m`);
			expect(loggedInfo.message).to.equal(`\u001b[32m\t${message}\u001b[39m`);
			expect(loggedInfo.timestamp).to.be.a.dateString();
			expect(loggedInfo.label).to.equal(SUBSYSTEM);
			expect(loggedInfo[Symbol.for(message)]).to.equal(
				// eslint-disable-next-line no-useless-escape
				`{\n  level: \'\\u001b[32m${level}\\u001b[39m\',\n  message: \'\\u001b[32m\\t${message}\\u001b[39m\',\n  label: \'SUBSYSTEM\',\n  timestamp: \'${loggedInfo.timestamp}\'\n}`
			);
		});
	});

	describe('formatterFor function spec', () => {
		it('throws when no recipe is registered', () => {
			const formattingManager = new FormattingManager();
			formattingManager.remove('align');
			expect(() => formattingManager.formatterFor('SUBSYSTEM')).to.throw('Order recipe is not configured');
		});

		it('throws when formatter from the recipe is not registered', () => {
			const formattingManager = new FormattingManager();
			formattingManager.remove('align');
			formattingManager.order(['not existing formatter']);
			expect(() => formattingManager.formatterFor('SUBSYSTEM')).to.throw(
				"Formatter 'not existing formatter' from the recipe is not registered"
			);
		});
	});

	it('creates an instance with predefined formatters and recipe', () => {
		const formattingManager = new FormattingManager();
		const SUBSYSTEM = 'SUBSYSTEM';
		let level;
		let loggedInfo;
		/* message formatting */
		const message = 'message';
		level = 'info';
		loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform({
			level,
			message
		});
		expect(loggedInfo.level).to.equal(level);
		expect(loggedInfo.message).to.equal(`\t${message}`);
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo.label).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for(message)]).to.equal(
			`${loggedInfo.timestamp} [${loggedInfo.label}] ${loggedInfo.level}: \t${message}`
		);
		/* error formatting */
		level = 'err';
		const err = new Error(message);
		loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform({
			level,
			message: err
		});
		expect(loggedInfo.level).to.equal(level);
		expect(loggedInfo.message).to.equal(`\t${err.message}`);
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo.label).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for(message)]).to.equal(
			`${loggedInfo.timestamp} [${loggedInfo.label}] ${loggedInfo.level}: \t${err.message}\n${err.stack}`
		);
	});

	it('adds new formatter, then if exists overwrites, then discards recipe', () => {
		const formattingManager1 = new FormattingManager();
		const SUBSYSTEM = 'SUBSYSTEM';
		const logLevel = 'info';
		const logMessage = 'message';
		let loggedInfo;
		/* overwrite existing one */
		formattingManager1.set(
			'printf',
			// eslint-disable-next-line no-unused-vars
			format.printf(({ level, message, label, timestamp, stack }) => {
				return `${timestamp} [${label}] ${level}`;
			})
		);
		/* recipe must be invalidated */
		expect(() => formattingManager1.formatterFor(SUBSYSTEM)).to.throw('Order recipe is not configured');
		formattingManager1.order(['timestamp', 'errors', 'splat', 'align', 'printf']);
		/* assert existing was overwritten */
		loggedInfo = formattingManager1.formatterFor(SUBSYSTEM).transform({
			level: logLevel,
			message: logMessage
		});
		expect(loggedInfo.level).to.equal(logLevel);
		expect(loggedInfo.message).to.equal(`\t${logMessage}`);
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo.label).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for('message')]).to.equal(
			`${loggedInfo.timestamp} [${loggedInfo.label}] ${loggedInfo.level}`
		);
		/* add new formatter */
		const formattingManager2 = new FormattingManager();
		formattingManager2.set('json', format.json({ space: 4 }));
		formattingManager2.order(['timestamp', 'errors', 'splat', 'json']);
		loggedInfo = formattingManager2.formatterFor(SUBSYSTEM).transform({
			level: logLevel,
			message: logMessage
		});
		expect(loggedInfo.level).to.equal(logLevel);
		expect(loggedInfo.message).to.equal(`${logMessage}`);
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo.label).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for('message')]).to.equal(
			JSON.stringify(
				{
					level: logLevel,
					message: logMessage,
					label: SUBSYSTEM,
					timestamp: loggedInfo.timestamp
				},
				null,
				4
			)
		);
	});

	it('removes formatter', () => {
		const formattingManager = new FormattingManager();
		formattingManager.remove('align');
		const SUBSYSTEM = 'SUBSYSTEM';
		const level = 'info';
		const message = 'message';
		formattingManager.order(['timestamp', 'errors', 'splat', 'printf']);
		const loggedInfo = formattingManager.formatterFor(SUBSYSTEM).transform({
			level,
			message
		});
		expect(loggedInfo.level).to.equal(level);
		expect(loggedInfo.message).to.equal(message);
		expect(loggedInfo.timestamp).to.be.a.dateString();
		expect(loggedInfo.label).to.equal(SUBSYSTEM);
		expect(loggedInfo[Symbol.for(message)]).to.equal(
			`${loggedInfo.timestamp} [${loggedInfo.label}] ${loggedInfo.level}: ${message}`
		);
	});

	it('order throws when recipe was defined already', () => {
		const formattingManager = new FormattingManager();
		expect(() => formattingManager.order(['foo formatter'])).to.throw('Order recipe configured already');
	});
});
