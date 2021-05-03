import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { JwtUserSessionMiddleware } from '../lib';
import { serverAddress } from './bootstrap';

describe(`${JwtUserSessionMiddleware.name} spec`, () => {
	it('starts tests', () => {
		expect(serverAddress).to.be.a('string');
	});
});
