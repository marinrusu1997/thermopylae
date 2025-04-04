import { describe, expect, it } from 'vitest';
import { Exception } from '../lib/index.js';

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
		expect(e.toString()).to.contain(`(${emitter}) [${code}] ${Exception.name}: ${message}`);
	});

	it('returns string representation (exception does not have origin)', () => {
		const emitter = 'emitter';
		const code = 'CODE';
		const message = 'message';
		const e = new Exception(emitter, code, message);
		expect(e.toString()).to.contain(`(${emitter}) [${code}] ${Exception.name}: ${message}`);
	});
});
