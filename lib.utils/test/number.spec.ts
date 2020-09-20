import { describe, it } from 'mocha';
import { expect } from 'chai';

import { Exception } from '@thermopylae/lib.exception';
import { Undefinable } from '@thermopylae/core.declarations';
import { randomInt, random, convertFrom, ErrorCodes, toLetter } from '../lib/number';

describe('number spec', () => {
	describe('randomness spec', () => {
		const LOWER_END = 1;
		const HIGHER_END = 5;

		it('generates random number', () => {
			for (let i = 0; i < 100; i++) {
				const randomNumber = random(LOWER_END, HIGHER_END);
				expect(randomNumber).to.be.gte(LOWER_END);
				expect(randomNumber).to.be.lt(HIGHER_END);
			}
		});

		it('generates random int', () => {
			for (let i = 0; i < 100; i++) {
				const randomInteger = randomInt(LOWER_END, HIGHER_END);
				expect(randomInteger).to.be.gte(LOWER_END);
				expect(randomInteger).to.be.lte(HIGHER_END);
				expect(randomInteger).to.be.eq(Math.trunc(randomInteger));
			}
		});
	});

	describe(`${convertFrom.name} spec`, () => {
		it('returns back null or undefined when no strict mode enabled', () => {
			expect(convertFrom(undefined)).to.be.eq(undefined);
			expect(convertFrom(null)).to.be.eq(null);
		});

		it('throws when passing null or undefined and strict mode is enabled', () => {
			function doTest() {
				try {
					convertFrom(value, true);
				} catch (e) {
					err = e;
				}
				expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.NUMBER_TYPE_CASTING_FAILED);
			}

			let value: null | undefined;
			let err: Undefinable<Error>;
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
