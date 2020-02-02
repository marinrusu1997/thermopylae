import { describe, it } from 'mocha';
import { chai } from './chai';
import { compare, fastUnSecureHash, generate, hash } from '../lib/token';

const { expect, assert } = chai;

describe('token spec', () => {
	describe('generate spec', () => {
		it('generates token of specified size (no hash option specified)', async () => {
			const TOKEN_SIZE = 10;
			const token = await generate(TOKEN_SIZE);
			expect(token.plain.length).to.be.equal(TOKEN_SIZE);
		});

		it('generates token of specified size (hash option specified)', async () => {
			const TOKEN_SIZE = 10;
			const HASHED_TOKEN_SIZE = 96; // constant for hashing algorithm
			const token = await generate(TOKEN_SIZE, true);
			expect(token.plain.length).to.be.equal(TOKEN_SIZE);
			expect(token.hash!.length).to.be.equal(HASHED_TOKEN_SIZE);
		});
	});

	describe('hash spec', () => {
		it('hashes token', async () => {
			const TOKEN_SIZE = 10;
			const HASHED_TOKEN_SIZE = 96; // constant for hashing algorithm
			const token = await generate(TOKEN_SIZE);
			expect(token.plain.length).to.be.equal(TOKEN_SIZE);
			const tokenHash = await hash(token.plain);
			expect(tokenHash.length).to.be.equal(HASHED_TOKEN_SIZE);
		});
	});

	describe('compare spec', () => {
		it('compares correctly different tokens (no hash option specified)', async () => {
			const token = await generate(10);
			const areEquals = await compare(token.plain, 'invalid');
			assert(!areEquals);
		});

		it('compares correctly different tokens (hash option specified)', async () => {
			const token = await generate(10);
			const areEquals = await compare(token.plain, 'invalid', true);
			assert(!areEquals);
		});

		it('compares correctly identical tokens (no hash option specified)', async () => {
			const token = await generate(10);
			const areEquals = await compare(token.plain, token.plain);
			assert(areEquals);
		});

		it('compares correctly identical tokens (hash option specified)', async () => {
			const token = await generate(10, true);
			const areEquals = await compare(token.hash!, token.plain, true);
			assert(areEquals);
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
