import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { LoggerManagerInstance } from '../lib';

describe('Lib spec', () => {
	it('exports a Logger singleton', () => {
		expect(() => {
			// @ts-ignore
			LoggerManagerInstance.console = null;
		}).to.throw("Cannot assign to read only property 'console' of object '#<Logger>'");
	});
});
