import { expect } from 'chai';
import { describe, it } from 'mocha';
import { multiply, sum } from '../lib';

describe('test', () => {
	it('add numbers', () => {
		expect(sum(1, 2, 3)).equals(6);
		expect(multiply(2, 2)).equals(4);
	});
});
