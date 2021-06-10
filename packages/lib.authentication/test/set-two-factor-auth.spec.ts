import { describe, it } from 'mocha';
import { assert, expect } from '@thermopylae/lib.unit-test';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { AccountWithTotpSecret, AuthenticationEngine, OnTwoFactorEnabledHookResult, TotpTwoFactorAuthStrategy } from '../lib';
import { buildAccountToBeRegistered } from './utils';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';

describe('Two Factor Auth Enable spec', function suite() {
	this.timeout(10_000); // @fixme remove when having proper net

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it.only('enables two factor auth', async () => {
		assert(
			AuthenticationEngineDefaultOptions['2fa-strategy'] instanceof TotpTwoFactorAuthStrategy,
			'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
		);

		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* ENABLE 2FA */
		const twoFactorEnableResult = (await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true)) as OnTwoFactorEnabledHookResult;
		expect(twoFactorEnableResult.totpSecretQRImageUrl).to.match(/^data:image\/png;base64,/);

		account = (await AccountRepositoryMongo.readById(account.id))!;
		expect(account.mfa).to.be.eq(true);
		expect(typeof account.totpSecret).to.be.eq('string');
	});
});
