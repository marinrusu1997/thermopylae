import { describe, it } from 'mocha';
import { chai } from './chai';
import { replaceAt } from '../lib/string';

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
});
