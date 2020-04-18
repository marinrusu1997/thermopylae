import { describe, it } from 'mocha';
import { expect } from 'chai';

import { Exception } from '@thermopylae/lib.exception';
import { ErrorCodes, toBoolean } from '../lib/boolean';

describe('boolean spec', () => {
	describe('toBoolean spec', () => {
		it('returns false for null or undefined', () => {
			expect(toBoolean(undefined)).to.be.eq(false);
			expect(toBoolean(null)).to.be.eq(false);
		});

		it("returns true for 'true', 'TRUE', 'yes', 'YES', 'YeS', '1' strings", () => {
			expect(toBoolean('true')).to.be.eq(true);
			expect(toBoolean('TRUE')).to.be.eq(true);
			expect(toBoolean('TruE')).to.be.eq(true);

			expect(toBoolean('yes')).to.be.eq(true);
			expect(toBoolean('YES')).to.be.eq(true);
			expect(toBoolean('YeS')).to.be.eq(true);

			expect(toBoolean('1')).to.be.eq(true);
		});

		it("returns false for 'false', 'FALSE', 'no', 'NO', 'No', '0' strings", () => {
			expect(toBoolean('false')).to.be.eq(false);
			expect(toBoolean('FALSE')).to.be.eq(false);
			expect(toBoolean('FalsE')).to.be.eq(false);

			expect(toBoolean('no')).to.be.eq(false);
			expect(toBoolean('NO')).to.be.eq(false);
			expect(toBoolean('No')).to.be.eq(false);

			expect(toBoolean('0')).to.be.eq(false);
		});

		it('converts numbers to boolean', () => {
			expect(toBoolean(1)).to.be.eq(true);
			expect(toBoolean(Infinity)).to.be.eq(true);

			expect(toBoolean(0)).to.be.eq(false);
			expect(toBoolean(NaN)).to.be.eq(false);
		});

		it('returns back the same value if it was a boolean', () => {
			expect(toBoolean(true)).to.be.eq(true);
			expect(toBoolean(false)).to.be.eq(false);
		});

		it('throws when value is null or undefined and strict mode is turned on', () => {
			let valueToConvert: null | undefined;

			let err;
			try {
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				toBoolean(valueToConvert, true);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);

			valueToConvert = null;
			err = undefined;

			try {
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				toBoolean(valueToConvert, true);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);
		});

		it("throws when can't convert to boolean (receiving value of type different than string or number)", () => {
			let valueToConvert: any = {};

			let err;
			try {
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				toBoolean(valueToConvert);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);

			valueToConvert = [];
			err = undefined;

			try {
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				toBoolean(valueToConvert);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED);
			expect(err).to.haveOwnProperty('message', `Can't cast ${valueToConvert} of type ${typeof valueToConvert} to boolean.`);
		});
	});
});
