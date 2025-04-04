import { Exception } from '@thermopylae/lib.exception';
import { describe, expect, it } from 'vitest';
import { ErrorCodes, convertFrom } from '../lib/boolean.js';

describe('boolean spec', () => {
	describe(`${convertFrom.name} spec`, () => {
		it('returns false for null or undefined', () => {
			expect(convertFrom(undefined)).to.be.eq(false);
			expect(convertFrom(null)).to.be.eq(false);
		});

		it("returns true for 'true', 'TRUE', 'yes', 'YES', 'YeS', '1' strings", () => {
			expect(convertFrom('true')).to.be.eq(true);
			expect(convertFrom('TRUE')).to.be.eq(true);
			expect(convertFrom('TruE')).to.be.eq(true);

			expect(convertFrom('yes')).to.be.eq(true);
			expect(convertFrom('YES')).to.be.eq(true);
			expect(convertFrom('YeS')).to.be.eq(true);

			expect(convertFrom('1')).to.be.eq(true);
		});

		it("returns false for 'false', 'FALSE', 'no', 'NO', 'No', '0' strings", () => {
			expect(convertFrom('false')).to.be.eq(false);
			expect(convertFrom('FALSE')).to.be.eq(false);
			expect(convertFrom('FalsE')).to.be.eq(false);

			expect(convertFrom('no')).to.be.eq(false);
			expect(convertFrom('NO')).to.be.eq(false);
			expect(convertFrom('No')).to.be.eq(false);

			expect(convertFrom('0')).to.be.eq(false);
		});

		it('converts numbers to boolean', () => {
			expect(convertFrom(1)).to.be.eq(true);
			expect(convertFrom(Infinity)).to.be.eq(true);

			expect(convertFrom(0)).to.be.eq(false);
			expect(convertFrom(NaN)).to.be.eq(false);
		});

		it('returns back the same value if it was a boolean', () => {
			expect(convertFrom(true)).to.be.eq(true);
			expect(convertFrom(false)).to.be.eq(false);
		});

		it('throws when value is null or undefined and strict mode is turned on', () => {
			let valueToConvert: null | undefined;

			let err;
			try {
				// @ts-ignore This is for testing
				convertFrom(valueToConvert, true);
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);

			valueToConvert = null;
			err = undefined;

			try {
				// @ts-ignore This is for testing
				convertFrom(valueToConvert, true);
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);
		});

		it("throws when can't convert to boolean (receiving value of type different than string or number)", () => {
			let valueToConvert = {};

			let err;
			try {
				// @ts-ignore This is for testing
				convertFrom(valueToConvert);
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);

			valueToConvert = [];
			err = undefined;

			try {
				// @ts-ignore This is for testing
				convertFrom(valueToConvert);
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);
		});
	});
});
