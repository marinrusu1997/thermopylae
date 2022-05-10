// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'chai';

import { Exception } from '@thermopylae/lib.exception';
import { Undefinable } from '@thermopylae/core.declarations';
import { randomInt, random, convertFrom, ErrorCodes, toLetter, percentage } from '../lib/number';

describe('number spec', () => {
	describe(`${random.name} spec`, () => {
		it('generates random number', () => {
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
			expect(() => random(1.1, 1.0)).to.throw(`${1.1} is greater than ${1.0}`);
			expect(() => random(2, 1)).to.throw(`${2} is greater than ${1}`);
		});
	});

	describe(`${randomInt.name} spec`, () => {
		it('generates random int', () => {
			const LOWER_END = 1;
			const HIGHER_END = 5;

			for (let i = 0; i < 100; i++) {
				const randomInteger = randomInt(LOWER_END, HIGHER_END);
				expect(randomInteger).to.be.gte(LOWER_END);
				expect(randomInteger).to.be.lte(HIGHER_END);
				expect(randomInteger).to.be.eq(Math.trunc(randomInteger));
			}
		});

		it('validates both interval ends', () => {
			expect(() => randomInt(0, 1)).to.not.throw(`${0} is greater than ${1}`);
			expect(() => randomInt(1, 1)).to.not.throw(`${1} is greater than ${1}`);
			expect(() => randomInt(1.1, 1.0)).to.throw(`${1.1} is greater than ${1.0}`);
			expect(() => randomInt(2, 1)).to.throw(`${2} is greater than ${1}`);
		});
	});

	describe(`${percentage.name} spec`, () => {
		it('calculates percentage', () => {
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
			expect(convertFrom(undefined)).to.be.eq(undefined);
			expect(convertFrom(null)).to.be.eq(null);
		});

		it('throws when passing null or undefined and strict mode is enabled', () => {
			let value: null | undefined;
			let err: Undefinable<Error>;

			function doTest() {
				try {
					convertFrom(value, true);
				} catch (e) {
					err = e;
				}
				expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.NUMBER_TYPE_CASTING_FAILED);
			}

			doTest();

			value = null;
			err = undefined;
			doTest();
		});

		it('converts to number', () => {
			expect(convertFrom('1')).to.be.eq(1);
			expect(convertFrom(1)).to.be.eq(1);
			expect(convertFrom(true)).to.be.eq(1);
		});
	});

	describe(`${toLetter.name} spec`, () => {
		it('returns number converted to letter', () => {
			expect(toLetter(10000000)).to.be.eq('2oMX');
		});
	});
});
