import { describe, expect, it } from 'vitest';
import { replaceAt, trimChar } from '../lib/string/index.js';

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
