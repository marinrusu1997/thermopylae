import { insertWithAssertion, MySqlClientInstance } from '@marin/lib.data-access';
import { models } from '@marin/lib.authentication-engine';
import { Done } from 'mocha';
import { expect } from 'chai';
import { exec } from 'child_process';
import { AuthRepository } from '../../lib/auth';
import { AccountEntity } from '../../lib/auth/account';
import { getLogger, MySqlEnv } from './setup';

interface TestsEnvironment {
	accounts: {
		firstAccount: {
			owner: models.AccountModel;
			firstLinkedUserId: string;
		};
		secondAccount: {
			owner: models.AccountModel;
			firstLinkedUserId: string;
		};
	};
}

const enum Roles {
	USER = 'USER',
	MODERATOR = 'MODERATOR'
}

const enum HashingAlgorithms {
	BCRYPT = 1,
	ARGON2 = 2
}

const TEST_ENV: TestsEnvironment = {
	accounts: {
		firstAccount: {
			owner: {
				username: 'username1',
				password: 'password1',
				salt: 'salt1',
				hashingAlg: HashingAlgorithms.BCRYPT,
				telephone: 'telephone1',
				email: 'email1',
				usingMfa: true,
				enabled: true,
				role: Roles.MODERATOR
			},
			firstLinkedUserId: 'user1_rel_acc_1'
		},
		secondAccount: {
			owner: {
				username: 'username2',
				password: 'password2',
				salt: 'salt2',
				hashingAlg: HashingAlgorithms.ARGON2,
				telephone: 'telephone2',
				email: 'email2',
				usingMfa: false,
				enabled: false,
				role: Roles.MODERATOR
			},
			firstLinkedUserId: 'user1_rel_acc_2'
		}
	}
};

function setUpDatabase(done: Done): void {
	truncateTables(async (err: Error) => {
		if (err) {
			return done(err);
		}

		try {
			await insertWithAssertion(MySqlClientInstance.writePool, `INSERT INTO Role (Name) VALUES ('${Roles.USER}');`);
			await insertWithAssertion(MySqlClientInstance.writePool, `INSERT INTO Role (Name) VALUES ('${Roles.MODERATOR}');`);

			return done();
		} catch (insertErr) {
			return done(insertErr);
		}
	});
}

function truncateTables(done: Function): void {
	const cmd = `
					mysql -h ${MySqlEnv.host} -P${MySqlEnv.port} -u${MySqlEnv.user} -p${MySqlEnv.password} -Nse 'SHOW TABLES;' ${MySqlEnv.database} | 
					while read table; do mysql -h ${MySqlEnv.host} -P${MySqlEnv.port} -u${MySqlEnv.user} -p${MySqlEnv.password} -e "DELETE FROM $table;" ${MySqlEnv.database}; done
				`;
	getLogger().debug(`Truncating tables. Executing: ${cmd}`);

	exec(cmd, (error, stdout, stderr) => {
		if (error) {
			// @ts-ignore
			done(error);
		} else {
			getLogger().debug(`Truncate all tables stdout:\n${stdout}`);
			getLogger().debug(`Truncate all tables stderr:\n${stderr}`);
			// @ts-ignore
			done();
		}
	});
}

async function createEnvAccounts(): Promise<void> {
	TEST_ENV.accounts.firstAccount.owner.id = await AuthRepository.accountEntity.create(TEST_ENV.accounts.firstAccount.owner);
	expect(TEST_ENV.accounts.firstAccount.owner.id).to.be.a('string').with.lengthOf(AccountEntity.ACCOUNT_ID_LENGTH);

	TEST_ENV.accounts.secondAccount.owner.id = await AuthRepository.accountEntity.create(TEST_ENV.accounts.secondAccount.owner);
	expect(TEST_ENV.accounts.secondAccount.owner.id).to.be.a('string').with.lengthOf(AccountEntity.ACCOUNT_ID_LENGTH);

	const insertUserCreatorAcc1AdditionalContacts = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.TELEPHONE_CONTACT_CLASS}', 'secondary', ?, '${TEST_ENV.accounts.firstAccount.owner.id}');`;
	await insertWithAssertion(
		MySqlClientInstance.writePool,
		insertUserCreatorAcc1AdditionalContacts,
		'telephone12',
		'Failed to INSERT user creator account 1 additional contacts'
	);

	const insertUserCreatorAcc2AdditionalContacts = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', 'secondary', ?, '${TEST_ENV.accounts.secondAccount.owner.id}');`;
	await insertWithAssertion(
		MySqlClientInstance.writePool,
		insertUserCreatorAcc2AdditionalContacts,
		'email22',
		'Failed to INSERT user creator account 2 additional contacts'
	);

	const insertUserRelToAcc1SQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID) 
										SELECT '${TEST_ENV.accounts.firstAccount.firstLinkedUserId}', '${TEST_ENV.accounts.firstAccount.owner.id}', ID 
										FROM Role 
										WHERE Name = '${Roles.USER}';`;
	await insertWithAssertion(MySqlClientInstance.writePool, insertUserRelToAcc1SQL, undefined, 'Failed to INSERT user related to account 1');

	const insertContactsUserRelToAcc1SQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.TELEPHONE_CONTACT_CLASS}', 'secondary', ?, '${TEST_ENV.accounts.firstAccount.firstLinkedUserId}');`;
	await insertWithAssertion(
		MySqlClientInstance.writePool,
		insertContactsUserRelToAcc1SQL,
		'telephone32',
		'Failed to INSERT user related to account 1 contacts'
	);

	const insertUserRelToAcc2SQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID) 
										SELECT '${TEST_ENV.accounts.secondAccount.firstLinkedUserId}', '${TEST_ENV.accounts.secondAccount.owner.id}', ID 
										FROM Role 
										WHERE Name = '${Roles.USER}';`;
	await insertWithAssertion(MySqlClientInstance.writePool, insertUserRelToAcc2SQL, undefined, 'Failed to INSERT user related to account 2');

	const insertContactsUserRelToAcc2SQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${TEST_ENV.accounts.secondAccount.firstLinkedUserId}');`;
	await insertWithAssertion(MySqlClientInstance.writePool, insertContactsUserRelToAcc2SQL, 'email41', 'Failed to INSERT user related to account 2 contacts');
}

function clearEnvAccounts(done: Done): void {
	MySqlClientInstance.writePool.query('DELETE FROM Account;', done);
}

export { TEST_ENV, HashingAlgorithms, Roles, setUpDatabase, createEnvAccounts, clearEnvAccounts };
