import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import { MySqlEnv } from '../setup';
import { AuthRepository } from '../../lib';
import { MySqlClientInstance } from '../../lib/clients/mysql';

describe('account spec', () => {
	const AccountEntity = AuthRepository.generateAccountEntity({
		'table-name': MySqlEnv.tables.account
	});

	afterEach(done => {
		MySqlClientInstance.writePool.query(`DELETE FROM ${MySqlEnv.tables.account} WHERE 1=1;`, done);
	});

	it('creates an account', async () => {
		const account = await AccountEntity.create({
			username: 'username',
			password: 'password',
			salt: 'salt',
			telephone: 'telephone',
			email: 'email',
			mfa: true,
			activated: true,
			locked: true
		});
		// @ts-ignore
		account.role = null;
		// @ts-ignore
		account.pubKey = null;
		expect(await AccountEntity.readById(account.id!)).to.be.deep.eq(account);
	});
});
