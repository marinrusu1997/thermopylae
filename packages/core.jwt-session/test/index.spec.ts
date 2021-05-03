import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import fetch from 'node-fetch';
import { JwtUserSessionMiddleware } from '../lib';
import { serverAddress } from './bootstrap';

describe(`${JwtUserSessionMiddleware.name} spec`, () => {
	it('authenticates and requests a resource', async () => {
		const response = await fetch(`${serverAddress}/login`, {
			method: 'POST'
		});
	});
});
