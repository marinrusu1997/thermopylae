import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { LoggerInstance } from '../lib';

describe('Lib spec', () => {
	it('exports a Logger singleton', () => {
		expect(() => {
			// @ts-ignore
			LoggerInstance.console = null;
		}).to.throw("Cannot assign to read only property 'console' of object '#<Logger>'");
	});
});
