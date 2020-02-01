import { describe, it } from 'mocha';
import { expect } from 'chai';
import Exception from '@marin/lib.error';
import { generateRandomNumber, generateArbitraryNumber, toNumber, ErrorCodes } from '../lib/number';

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

	describe('toNumber spec', () => {
		it('returns back null or undefined when no strict mode enabled', () => {
			expect(toNumber(undefined)).to.be.eq(undefined);
			expect(toNumber(null)).to.be.eq(null);
		});

		it('throws when passing null or undefined and strict mode is enabled', () => {
			function doTest() {
				try {
					toNumber(value, true);
				} catch (e) {
					err = e;
				}
				expect(err)
					.to.be.instanceOf(Exception)
					.and.to.haveOwnProperty('code', ErrorCodes.NUMBER_TYPE_CASTING_FAILED);
			}

			let value: null | undefined;
			let err: any;
			doTest();

			value = null;
			err = undefined;
			doTest();
		});

		it('converts to number', () => {
			expect(toNumber('1')).to.be.eq(1);
			expect(toNumber(1)).to.be.eq(1);
			expect(toNumber(true)).to.be.eq(1);
		});
	});
});
