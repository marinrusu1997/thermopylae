import type { ObjMap } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import { describe, expect, it } from 'vitest';
import { token as tokenModule } from '../lib/index.js';

const { ErrorCodes, fastUnSecureHash, generate } = tokenModule;

describe('token spec', () => {
	describe('generate spec', () => {
		function generateTokenSpec(tokenGenerationType: tokenModule.TokenGenerationType): void {
			it('generates token of default length', () => {
				const token = generate(tokenGenerationType);
				expect(token.length).to.be.equal(32);
			});

			it('generates tokens with variable length', () => {
				for (let i = 1; i < 100; i++) {
					const token = generate(tokenGenerationType, i);
					expect(token.length).to.be.equal(i);
				}
			});
		}

		describe(`${tokenModule.TokenGenerationType.CRYPTOGRAPHIC} generation type`, () => {
			generateTokenSpec(tokenModule.TokenGenerationType.CRYPTOGRAPHIC);
		});

		describe(`${tokenModule.TokenGenerationType.NORMAL} generation type`, () => {
			generateTokenSpec(tokenModule.TokenGenerationType.NORMAL);
		});

		it('throws when unknown token generation mechanism is specified', () => {
			let err;
			try {
				// @ts-ignore This is just a test
				generate('invalid');
			} catch (e) {
				err = e;
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
			expect(fastUnSecureHash({ a: 1 })).to.be.eq(1442153986);
		});

		it('hashes strings', () => {
			expect(fastUnSecureHash('adaj')).to.be.eq(2988940);
		});

		it('hashes empty strings', () => {
			expect(fastUnSecureHash('')).to.be.eq(0);
		});

		it('hashes numbers', () => {
			expect(fastUnSecureHash(1 as unknown as ObjMap)).to.be.eq(49);
		});

		it('hashes null', () => {
			expect(fastUnSecureHash(null as unknown as ObjMap)).to.be.eq(3392903);
		});

		it('hashes boolean', () => {
			expect(fastUnSecureHash(true as unknown as ObjMap)).to.be.eq(3569038);
		});
	});
});
