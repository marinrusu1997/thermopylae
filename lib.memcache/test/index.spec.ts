import { describe, it } from 'mocha';
import { chai } from './chai';
import { getDefaultMemCache, MemCache } from '../lib';

const { expect } = chai;

describe('lib index spec', () => {
	it('returns default mem cache', () => {
		const cache = getDefaultMemCache();
		expect(cache).to.not.be.equal(undefined);
		expect(cache).be.instanceOf(MemCache);
	});
});
