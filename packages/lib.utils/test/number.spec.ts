import { Exception } from '@thermopylae/lib.exception';
import { describe, expect, it } from 'vitest';
import { ErrorCodes, convertFrom, percentage, random, toLetter } from '../lib/number.js';

describe('number spec', () => {
	describe(`${random.name} spec`, () => {
		it('generates random number', () => {
			expect.hasAssertions();

			const LOWER_END = 1;
			const HIGHER_END = 5;

			for (let i = 0; i < 100; i++) {
				const randomNumber = random(LOWER_END, HIGHER_END);
				expect(randomNumber).to.be.gte(LOWER_END);
				expect(randomNumber).to.be.lt(HIGHER_END);
			}
		});

		it('validates both interval ends', () => {
			expect(() => random(0, 1)).to.not.throw(`${0} is greater than ${1}`);
			expect(() => random(1, 1)).to.not.throw(`${1} is greater than ${1}`);
			expect(() => random(1.1, 1)).to.throw(`${1.1} is greater than ${1}`);
			expect(() => random(2, 1)).to.throw(`${2} is greater than ${1}`);
		});
	});

	describe(`${percentage.name} spec`, () => {
		it('calculates percentage', () => {
			expect.hasAssertions();

			for (let i = 0; i <= 1; i += 0.1) {
				expect(percentage(100, i)).to.be.eq(i * 100);
			}
		});

		it('throws on invalid percentage', () => {
			expect(() => percentage(100, -0.1)).to.throw(Exception);
			expect(() => percentage(100, 1.1)).to.throw(Exception);
		});
	});

	describe(`${convertFrom.name} spec`, () => {
		it('returns back null or undefined when no strict mode enabled', () => {
			expect(convertFrom(null)).to.be.eq(null);
		});

		it('throws when passing null or undefined and strict mode is enabled', () => {
			let err: Error | null = null;
			try {
				convertFrom(null, true);
			} catch (error) {
				err = error as Error;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.NUMBER_TYPE_CASTING_FAILED);
		});

		it('converts to number', () => {
			expect(convertFrom('1')).to.be.eq(1);
			expect(convertFrom(1)).to.be.eq(1);
			expect(convertFrom(true)).to.be.eq(1);
		});
	});

	describe(`${toLetter.name} spec`, () => {
		it('returns number converted to letter', () => {
			expect(toLetter(10_000_000)).to.be.eq('2oMX');
		});
	});
});
