import { setTimeout } from 'node:timers/promises';
import { assert, describe, expect, it } from 'vitest';
import { Totp } from '../lib/totp.js';

describe(`${Totp.name} spec`, () => {
	describe(`${Totp.prototype.generate.name} spec`, () => {
		it('generates secret', () => {
			expect(new Totp({ secret: 'secret', ttl: 1 }).generate()).to.not.be.equal(undefined);
		});
	});

	describe(`${Totp.prototype.check.name} spec`, () => {
		it('returns false on invalid tokens (no stored token provided)', () => {
			assert(!new Totp({ secret: 'secret', ttl: 1 }).check('invalid'));
		});

		it('returns false on invalid token (stored token provided)', () => {
			assert(!new Totp({ secret: 'secret', ttl: 1 }).check('invalid', 'stored'));
		});

		it('returns false on expired token', async () => {
			const instance = new Totp({ secret: 'secret', ttl: 1 });
			const token = instance.generate();
			assert(instance.check(token)); // it is valid right after generation]

			await setTimeout(1000);
			assert(!instance.check(token)); // but invalid after ttl expires
		});

		it('returns true on valid token (no stored token provided)', () => {
			const instance = new Totp({ secret: 'secret', ttl: 1 });
			assert(instance.check(instance.generate()));
		});

		it('returns true on valid token (stored token provided)', () => {
			const instance = new Totp({ secret: 'secret', ttl: 1 });
			const token = instance.generate();
			assert(instance.check(token, token));
		});
	});
});
