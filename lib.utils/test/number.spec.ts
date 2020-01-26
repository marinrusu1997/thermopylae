import { describe, it } from 'mocha';
import { expect } from 'chai';
import { generateRandomNumber, generateArbitraryNumber } from '../lib/number';

describe('number spec', () => {
	describe('randomness spec', () => {
		const LOWER_END = 1;
		const HIGHER_END = 5;

		it('generates arbitrary number', () => {
			for (let i = 0; i < 100; i++) {
				const random = generateArbitraryNumber(LOWER_END, HIGHER_END);
				expect(random).to.be.gte(LOWER_END);
				expect(random).to.be.lt(HIGHER_END);
			}
		});

		it('generates random number', () => {
			for (let i = 0; i < 100; i++) {
				const random = generateRandomNumber(LOWER_END, HIGHER_END);
				expect(random).to.be.gte(LOWER_END);
				expect(random).to.be.lte(HIGHER_END);
			}
		});
	});
});
