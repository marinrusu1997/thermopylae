import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import colors from 'colors';
import { LFUDAEvictionPolicy } from '../../../lib/policies/eviction/lfuda';

describe(`${colors.magenta(LFUDAEvictionPolicy.name)} spec`, () => {
	it('works', () => {
		expect(true).to.be.eq(true);
	});
});
