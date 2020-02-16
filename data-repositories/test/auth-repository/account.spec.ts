import { describe, it } from 'mocha';
import { expect } from 'chai';
import { MySqlEnv } from '../setup';

describe('account spec', () => {
	it('checks that password is secret', () => {
		expect(MySqlEnv.password).to.be.eq('secret');
	});
});
