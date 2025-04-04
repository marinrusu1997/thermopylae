import { describe, expect, it } from 'vitest';
import { random, replaceAt, trimChar } from '../lib/string.js';

describe('string spec', () => {
	describe(`${replaceAt.name} spec`, () => {
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

	describe(`${random.name} spec`, () => {
		it('generates random string of specified length', () => {
			const length = 5;
			const generatedString = random({ length });
			expect(generatedString.length).to.be.eq(length);
		});

		it('generates random string with digits', () => {
			const generatedString = random({ length: 5, allowedCharRegex: /^[0-9]$/ });
			for (let i = 0; i < generatedString.length; i++) {
				expect(Number.isNaN(Number(generatedString[i]))).to.be.eq(false);
			}
		});

		it('generates random string with capitalized alpha and some special characters', () => {
			const allowedCharRegex = /^[A-Z$()]$/;
			const generatedString = random({ length: 20, allowedCharRegex });

			for (let i = 0; i < generatedString.length; i++) {
				expect(generatedString[i]).to.match(allowedCharRegex);
			}
		});

		it('can generate custom random string using invocations with different regexes', () => {
			const generatedString = [
				random({ length: 1, allowedCharRegex: /^[0-9]$/ }),
				random({ length: 3, allowedCharRegex: /^[a-zA-Z]$/ }),
				random({ length: 1, allowedCharRegex: /^[0-9]$/ })
			].join('');
			expect(Number.isNaN(Number(generatedString[0]))).to.be.eq(false);

			for (let i = 1; i < generatedString.length - 1; i++) {
				expect(Number.isNaN(Number(generatedString[i]))).to.be.eq(true);
			}

			expect(Number.isNaN(Number(generatedString[generatedString.length - 1]))).to.be.eq(false);
		});
	});

	describe(`${trimChar.name} spec`, () => {
		it('trim dots from begin of string', () => {
			expect(trimChar('....aa', '.')).to.be.eq('aa');
		});

		it('trim dots from end of string', () => {
			expect(trimChar('aa...', '.')).to.be.eq('aa');
		});

		it('trim dots from both ends of string', () => {
			expect(trimChar('.....aa...', '.')).to.be.eq('aa');
		});

		it('do not trims if no dots', () => {
			expect(trimChar('aa', '.')).to.be.eq('aa');
		});
	});
});
