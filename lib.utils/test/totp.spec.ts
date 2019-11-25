import { describe, it } from 'mocha';
import { chai } from './chai';
import { Totp } from '../lib/totp';

const { expect, assert } = chai;

describe('totp spec', () => {
	it('generates secret', () => {
		expect(new Totp({ secret: 'secret', ttl: 1 }).generate()).to.not.be.equal(undefined);
	});

	it('checks correctly invalid tokens (no stored token provided)', () => {
		assert(!new Totp({ secret: 'secret', ttl: 1 }).check('invalid'));
	});

	it('checks correctly invalid token (stored token provided)', () => {
		assert(!new Totp({ secret: 'secret', ttl: 1 }).check('invalid', 'stored'));
	});

	it('checks correctly expired token', done => {
		const instance = new Totp({ secret: 'secret', ttl: 1 });
		const token = instance.generate();
		setTimeout(() => {
			assert(!instance.check(token));
			done();
		}, 1000);
	});

	it('checks correctly valid token (no stored token provided)', () => {
		const instance = new Totp({ secret: 'secret', ttl: 1 });
		assert(instance.check(instance.generate()));
	});

	it('checks correctly valid token (stored token provided)', () => {
		const instance = new Totp({ secret: 'secret', ttl: 1 });
		const token = instance.generate();
		assert(instance.check(token, token));
	});
});
