import { describe, it } from 'mocha';
import { chai } from './chai';
import { compareTokens, generateToken, hashToken } from '../lib/token';

const { expect, assert } = chai;

describe('token spec', () => {
	it('generates token of specified size (no hash option specified)', async () => {
		const TOKEN_SIZE = 10;
		const token = await generateToken(TOKEN_SIZE);
		expect(token.plain.length).to.be.equal(TOKEN_SIZE);
	});

	it('generates token of specified size (hash option specified)', async () => {
		const TOKEN_SIZE = 10;
		const HASHED_TOKEN_SIZE = 96; // constant for hashing algorithm
		const token = await generateToken(TOKEN_SIZE, true);
		expect(token.plain.length).to.be.equal(TOKEN_SIZE);
		expect(token.hash!.length).to.be.equal(HASHED_TOKEN_SIZE);
	});

	it('hashes token', async () => {
		const TOKEN_SIZE = 10;
		const HASHED_TOKEN_SIZE = 96; // constant for hashing algorithm
		const token = await generateToken(TOKEN_SIZE);
		expect(token.plain.length).to.be.equal(TOKEN_SIZE);
		const hash = await hashToken(token.plain);
		expect(hash.length).to.be.equal(HASHED_TOKEN_SIZE);
	});

	it('compares correctly different tokens (no hash option specified)', async () => {
		const token = await generateToken(10);
		const areEquals = await compareTokens(token.plain, 'invalid');
		assert(!areEquals);
	});

	it('compares correctly different tokens (hash option specified)', async () => {
		const token = await generateToken(10);
		const areEquals = await compareTokens(token.plain, 'invalid', true);
		assert(!areEquals);
	});

	it('compares correctly identical tokens (no hash option specified)', async () => {
		const token = await generateToken(10);
		const areEquals = await compareTokens(token.plain, token.plain);
		assert(areEquals);
	});

	it('compares correctly identical tokens (hash option specified)', async () => {
		const token = await generateToken(10, true);
		const areEquals = await compareTokens(token.hash!, token.plain, true);
		assert(areEquals);
	});
});
