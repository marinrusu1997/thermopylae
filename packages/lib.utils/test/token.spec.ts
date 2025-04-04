import type { ObjMap } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import { describe, expect, it } from 'vitest';
import { token as tokenModule } from '../lib/index.js';

const { ErrorCodes, fastUnSecureHash, generate } = tokenModule;

describe('token spec', () => {
	describe('generate spec', () => {
		describe(`${tokenModule.TokenGenerationType.CRYPTOGRAPHIC} generation type`, () => {
			it('generates token of default length', () => {
				const token = generate(tokenModule.TokenGenerationType.CRYPTOGRAPHIC);
				expect(token.length).to.be.equal(32);
			});

			it('generates tokens with variable length', () => {
				expect.hasAssertions();

				for (let i = 1; i < 100; i++) {
					const token = generate(tokenModule.TokenGenerationType.CRYPTOGRAPHIC, i);
					expect(token.length).to.be.equal(i);
				}
			});
		});

		describe(`${tokenModule.TokenGenerationType.NORMAL} generation type`, () => {
			it('generates token of default length', () => {
				const token = generate(tokenModule.TokenGenerationType.NORMAL);
				expect(token.length).to.be.equal(32);
			});

			it('generates tokens with variable length', () => {
				expect.hasAssertions();

				for (let i = 1; i < 100; i++) {
					const token = generate(tokenModule.TokenGenerationType.NORMAL, i);
					expect(token.length).to.be.equal(i);
				}
			});
		});

		it('throws when unknown token generation mechanism is specified', () => {
			let err: Error | null = null;
			try {
				// @ts-expect-error This is just a testa test
				generate('invalid');
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(Exception);
			expect(err).to.haveOwnProperty('code', ErrorCodes.UNKNOWN_TOKEN_GENERATION_TYPE);
			expect(err).to.haveOwnProperty(
				'message',
				`Received: invalid. Allowed: ${tokenModule.TokenGenerationType.CRYPTOGRAPHIC}, ${tokenModule.TokenGenerationType.NORMAL}`
			);
		});
	});

	describe('fastUnSecureHash spec', () => {
		it('hashes objects', () => {
			expect(fastUnSecureHash({ a: 1 })).to.be.eq(1_442_153_986);
		});

		it('hashes strings', () => {
			expect(fastUnSecureHash('adaj')).to.be.eq(2_988_940);
		});

		it('hashes empty strings', () => {
			expect(fastUnSecureHash('')).to.be.eq(0);
		});

		it('hashes numbers', () => {
			expect(fastUnSecureHash(1 as unknown as ObjMap)).to.be.eq(49);
		});

		it('hashes null', () => {
			expect(fastUnSecureHash(null as unknown as ObjMap)).to.be.eq(3_392_903);
		});

		it('hashes boolean', () => {
			expect(fastUnSecureHash(true as unknown as ObjMap)).to.be.eq(3_569_038);
		});
	});
});
