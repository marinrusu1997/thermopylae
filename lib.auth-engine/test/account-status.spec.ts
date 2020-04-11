import { describe, it } from 'mocha';
import { expect } from 'chai';
import { string } from '@marin/lib.utils';
import { Exception } from '@marin/lib.error';
import { AuthenticationEngine, ErrorCodes } from '../lib';
import basicAuthEngineConfig from './fixtures';

describe('Account Status spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(basicAuthEngineConfig);

	it("fails to disable account if it wasn't found", async () => {
		let accountNotFoundErr;

		const accountId = string.generateStringOfLength(12, /[a-zA-Z0-9]/);

		try {
			await AuthEngineInstance.disableAccount(accountId, 'does not matter');
		} catch (e) {
			accountNotFoundErr = e;
		}

		expect(accountNotFoundErr).to.be.instanceOf(Exception);
		expect(accountNotFoundErr).to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(accountNotFoundErr).to.haveOwnProperty('message', `Account with id ${accountId} not found. `);
	});
});
