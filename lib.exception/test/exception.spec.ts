import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Exception } from '../lib';

describe('exception spec', () => {
	it('creates exception', () => {
		const emitter = 'emitter';
		const code = 'CODE';
		const message = 'message';
		const data = {};
		const e = new Exception(emitter, code, message, data);
		expect(e.name).to.be.equal('Exception');
		expect(e.cause).to.be.deep.equal(data);
	});

	it('returns string representation', () => {
		const emitter = 'emitter';
		const code = 'CODE';
		const message = 'message';
		const data = {};
		const e = new Exception(emitter, code, message, data);
		expect(e.toString()).to.be.equal(`[${emitter}] ${code}: ${message}`);
	});
});
