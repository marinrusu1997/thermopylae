import { describe, expect, it } from 'vitest';
import { convertFrom } from '../lib/boolean.js';

describe('boolean spec', () => {
	describe(`${convertFrom.name} spec`, () => {
		it('returns false for null or undefined', () => {
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
			expect(() => convertFrom(Infinity)).to.throw("Value `Infinity` can't be converted to a boolean value.");

			expect(convertFrom(0)).to.be.eq(false);
			expect(() => convertFrom(Number.NaN)).to.throw("Value `NaN` can't be converted to a boolean value.");
		});

		it('returns back the same value if it was a boolean', () => {
			expect(convertFrom(true)).to.be.eq(true);
			expect(convertFrom(false)).to.be.eq(false);
		});
	});
});
