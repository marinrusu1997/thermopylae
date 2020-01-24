import { describe, it } from 'mocha';
import { chai } from './chai';
import { generateString, replaceAt } from '../lib/string';

const { expect } = chai;

describe('string spec', () => {
	describe('replaceAt spec', () => {
		it('replaces elements from empty strings', () => {
			let str = '';
			str = replaceAt('replacement', 0, str);
			expect(str).to.be.eq('replacement');
		});

		it('replaces at the begin of the string', () => {
			let str = 'garbage';
			str = replaceAt('bad ', 0, str);
			expect(str).to.be.eq('bad age');
		});

		it('replaces string in the middle', () => {
			let str = 'garbage';
			str = replaceAt('bad ', 3, str);
			expect(str).to.be.eq('garbad ');
		});

		it('replaces string at the end', () => {
			let str = 'garbage';
			str = replaceAt('bad ', str.length, str);
			expect(str).to.be.eq('garbagebad ');
		});
	});

	describe('generateString spec', () => {
		it('generates random string of specified length', () => {
			const length = 5;
			const generatedString = generateString(length);
			expect(generatedString.length).to.be.eq(length);
		});

		it('generates random string with digits', () => {
			const generatedString = generateString(5, /^[0-9]$/);
			for (let i = 0; i < generatedString.length; i++) {
				expect(Number.isNaN(Number(generatedString[i]))).to.be.eq(false);
			}
		});

		it('can generate custom random string using invocations with different regexes', () => {
			const generatedString = `${generateString(1, /^[0-9]$/)}${generateString(3, /^[a-zA-Z]$/)}${generateString(1, /^[0-9]$/)}`;
			expect(Number.isNaN(Number(generatedString[0]))).to.be.eq(false);
			for (let i = 1; i < generatedString.length - 1; i++) {
				expect(Number.isNaN(Number(generatedString[i]))).to.be.eq(true);
			}
			expect(Number.isNaN(Number(generatedString[generatedString.length - 1]))).to.be.eq(false);
		});
	});
});
