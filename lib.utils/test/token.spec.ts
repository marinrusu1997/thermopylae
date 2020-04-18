import { describe, it } from 'mocha';

import { Exception } from '@thermopylae/lib.exception';
import { chai } from './chai';
import { token as tokenModule } from '../lib';

const { expect } = chai;
const { ErrorCodes, fastUnSecureHash, generate, TokenGenerationType } = tokenModule;

describe('token spec', () => {
	describe('generate spec', () => {
		it('generates cryptographically-strong token', () => {
			const token = generate(TokenGenerationType.CRYPTOGRAPHYCAL);
			expect(token.length).to.be.equal(36);
		});

		it('generates normal token', () => {
			const token = generate(TokenGenerationType.NORMAL);
			expect(token.length).to.be.equal(36);
		});

		it('throws when unknown token generation mechanism is specified', () => {
			let err;
			try {
				// @ts-ignore
				generate('invalid');
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception);
			expect(err).to.haveOwnProperty('code', ErrorCodes.UNKNOWN_TOKEN_GENERATION_TYPE);
			expect(err).to.haveOwnProperty('message', `Received: invalid. Allowed: ${TokenGenerationType.CRYPTOGRAPHYCAL}, ${TokenGenerationType.NORMAL}`);
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
			expect(fastUnSecureHash(1)).to.be.eq(49);
		});

		it('hashes null', () => {
			expect(fastUnSecureHash(null)).to.be.eq(3392903);
		});

		it('hashes boolean', () => {
			expect(fastUnSecureHash(true)).to.be.eq(3569038);
		});
	});
});
