import { insertWithAssertion, MySqlClientInstance, OkPacket } from '@marin/lib.data-access';
import { number, string } from '@marin/lib.utils';
import { AsyncFunction } from '@marin/lib.utils/dist/declarations';
import { expect } from 'chai';
import { AuthRepository } from '../../lib/auth';
import { AccountEntity } from '../../lib/auth/account';
import { HashingAlgorithms, ResourceType, Roles, SAFE_MYSQL_CHAR_REGEX, TestsEnvironment, TestsEnvironmentStats } from './commons';
import { Logger } from './logger';

const { generateRandom } = number;
const { generateStringOfLength } = string;

const GENERATED_STR_LEN = 5;

const TEST_ENV: Readonly<TestsEnvironment> = {
	accounts: {
		firstAccount: {
			owner: {
				username: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				password: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				salt: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				hashingAlg: HashingAlgorithms.BCRYPT,
				telephone: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				email: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				usingMfa: true,
				enabled: true,
				role: Roles.MODERATOR
			},
			firstLinkedUserId: 'user1_rel_acc_1'
		},
		secondAccount: {
			owner: {
				username: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				password: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				salt: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				hashingAlg: HashingAlgorithms.ARGON2,
				telephone: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				email: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
				usingMfa: false,
				enabled: false,
				role: Roles.MODERATOR
			},
			firstLinkedUserId: 'user1_rel_acc_2'
		}
	},
	devices: {
		ANDROID: {
			ID: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
			OperatingSystem: 'Linux',
			Platform: 'Android',
			Browser: null,
			Version: '9',
			Source: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX)
		},
		IOS: {
			ID: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
			OperatingSystem: 'iOS',
			Platform: 'iOS',
			Browser: null,
			Version: '13',
			Source: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX)
		}
	},
	locations: {
		RO: {
			ID: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
			CountryCode: 'RO',
			RegionCode: 'B',
			City: 'Bucharest',
			Latitude: 45.6,
			Longitude: 48.4,
			TimeZone: 'UTC+2',
			PostalCode: 'RO-481465'
		},
		MD: {
			ID: generateStringOfLength(GENERATED_STR_LEN, SAFE_MYSQL_CHAR_REGEX),
			CountryCode: 'MD',
			RegionCode: 'K',
			City: 'Chisinau',
			Latitude: 44.6,
			Longitude: 43.4,
			TimeZone: 'UTC+2',
			PostalCode: 'MD-64541'
		}
	},
	roles: {
		USER: {
			ID: generateRandom(0, 10),
			Name: Roles.USER
		},
		MODERATOR: {
			ID: generateRandom(0, 10),
			Name: Roles.MODERATOR
		},
		CUSTOMER: {
			ID: generateRandom(0, 10),
			Name: Roles.CUSTOMER
		},
		MANAGER: {
			ID: generateRandom(0, 10),
			Name: Roles.MANAGER
		}
	},
	permissions: {
		ACCOUNTING: {
			ID: generateRandom(0, 10),
			Category: 'ACCOUNTING',
			Resource: 'SALARY',
			Operation: 'R'
		},
		CHAT: {
			ID: generateRandom(0, 10),
			Category: 'CHAT',
			Resource: 'MESSAGE',
			Operation: 'RW'
		}
	},
	userGroups: {
		CUSTOMERS: {
			ID: generateRandom(0, 10),
			Name: 'CUSTOMERS'
		},
		MANAGERS: {
			ID: generateRandom(0, 10),
			Name: 'MANAGERS'
		},
		MODERATORS: {
			ID: generateRandom(0, 10),
			Name: 'MODERATORS'
		},
		USERS: {
			ID: generateRandom(0, 10),
			Name: 'USERS'
		}
	}
};

const TEST_ENV_STATS: TestsEnvironmentStats = {
	RESOURCES: {
		ACCOUNT_NO: Object.keys(TEST_ENV.accounts).length,
		USERS_NO: Object.keys(TEST_ENV.accounts)
			// @ts-ignore, count number of users for each account
			.map((account) => Object.keys(TEST_ENV.accounts[account]).length)
			.reduce((prev, cur) => prev + cur, 0),
		PERMISSIONS_NO: Object.keys(TEST_ENV.permissions).length,
		ROLES_NO: Object.keys(TEST_ENV.roles).length,
		DEVICES_NO: Object.keys(TEST_ENV.devices).length,
		LOCATIONS_NO: Object.keys(TEST_ENV.locations).length,
		USER_GROUPS_NO: Object.keys(TEST_ENV.userGroups).length
	},

	FIRST_ACCOUNT: {
		OWNER_USER: {
			CONTACTS_NO: 0
		},
		LINKED_USER: {
			CONTACTS_NO: 0
		}
	},
	SECOND_ACCOUNT: {
		OWNER_USER: {
			CONTACTS_NO: 0
		},
		LINKED_USER: {
			CONTACTS_NO: 0
		}
	}
};

interface EnvResourceCreators {
	[resource: string]: AsyncFunction;
}

const ENV_RESOURCE_CREATORS: EnvResourceCreators = {
	[ResourceType.ACCOUNT]: createEnvAccounts,
	[ResourceType.DEVICE]: createEnvDevices,
	[ResourceType.LOCATION]: createEnvLocations,
	[ResourceType.PERMISSION]: createEnvPermissions,
	[ResourceType.ROLE]: createEnvRoles,
	[ResourceType.USER_GROUP]: createEnvUserGroups
};

async function createEnvAccounts(): Promise<void> {
	Logger.debug('Creating ENV Accounts...');

	await createEnvRoles();

	TEST_ENV.accounts.firstAccount.owner.id = await AuthRepository.accountEntity.create(TEST_ENV.accounts.firstAccount.owner);
	expect(TEST_ENV.accounts.firstAccount.owner.id).to.be.a('string').with.lengthOf(AccountEntity.ACCOUNT_ID_LENGTH);
	TEST_ENV_STATS.FIRST_ACCOUNT.OWNER_USER.CONTACTS_NO = 2;

	TEST_ENV.accounts.secondAccount.owner.id = await AuthRepository.accountEntity.create(TEST_ENV.accounts.secondAccount.owner);
	expect(TEST_ENV.accounts.secondAccount.owner.id).to.be.a('string').with.lengthOf(AccountEntity.ACCOUNT_ID_LENGTH);
	TEST_ENV_STATS.SECOND_ACCOUNT.OWNER_USER.CONTACTS_NO = 2;

	const insertUserCreatorAcc1AdditionalContacts = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.TELEPHONE_CONTACT_CLASS}', 'secondary', ?, '${TEST_ENV.accounts.firstAccount.owner.id}');`;
	await insertWithAssertion(
		MySqlClientInstance.writePool,
		insertUserCreatorAcc1AdditionalContacts,
		'telephone12',
		'Failed to INSERT user creator account 1 additional contacts'
	);
	TEST_ENV_STATS.FIRST_ACCOUNT.OWNER_USER.CONTACTS_NO += 1;

	const insertUserCreatorAcc2AdditionalContacts = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', 'secondary', ?, '${TEST_ENV.accounts.secondAccount.owner.id}');`;
	await insertWithAssertion(
		MySqlClientInstance.writePool,
		insertUserCreatorAcc2AdditionalContacts,
		'email22',
		'Failed to INSERT user creator account 2 additional contacts'
	);
	TEST_ENV_STATS.SECOND_ACCOUNT.OWNER_USER.CONTACTS_NO += 1;

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
	TEST_ENV_STATS.FIRST_ACCOUNT.LINKED_USER.CONTACTS_NO = 1;

	const insertUserRelToAcc2SQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID) 
										SELECT '${TEST_ENV.accounts.secondAccount.firstLinkedUserId}', '${TEST_ENV.accounts.secondAccount.owner.id}', ID 
										FROM Role 
										WHERE Name = '${Roles.USER}';`;
	await insertWithAssertion(MySqlClientInstance.writePool, insertUserRelToAcc2SQL, undefined, 'Failed to INSERT user related to account 2');

	const insertContactsUserRelToAcc2SQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${TEST_ENV.accounts.secondAccount.firstLinkedUserId}');`;
	await insertWithAssertion(MySqlClientInstance.writePool, insertContactsUserRelToAcc2SQL, 'email41', 'Failed to INSERT user related to account 2 contacts');
	TEST_ENV_STATS.SECOND_ACCOUNT.LINKED_USER.CONTACTS_NO = 1;
}

async function createEnvDevices(): Promise<void> {
	Logger.debug('Creating ENV Devices...');

	const devices: Array<string> = Object.values(TEST_ENV.devices).map(
		(device) => `('${device.ID}', '${device.OperatingSystem}', '${device.Platform}', '${device.Browser}', '${device.Version}', '${device.Source}')`
	);

	const insertDevicesSQL = `INSERT INTO Device (ID, OperatingSystem, Platform, Browser, Version, Source) VALUES ${devices.join(',')};`;

	await insertWithAssertion(MySqlClientInstance.writePool, insertDevicesSQL, undefined, 'Failed INSERT Devices', devices.length);
}

async function createEnvLocations(): Promise<void> {
	Logger.debug('Creating ENV Locations...');

	const locations: Array<string> = Object.values(TEST_ENV.locations).map(
		(location) =>
			`('${location.ID}', '${location.CountryCode}', '${location.RegionCode}', '${location.City}', '${location.TimeZone}', ${location.Latitude}, ${location.Longitude}, '${location.PostalCode}')`
	);

	const insertLocationsSQL = `INSERT INTO Location (ID, CountryCode, RegionCode, City, TimeZone, Latitude, Longitude, PostalCode) 
									VALUES ${locations.join(',')};`;

	await insertWithAssertion(MySqlClientInstance.writePool, insertLocationsSQL, undefined, 'Failed INSERT Locations', locations.length);
}

async function createEnvPermissions(): Promise<void> {
	Logger.debug('Creating ENV Permissions...');

	const permissions = Object.values(TEST_ENV.permissions);

	const permissionsSQL = permissions.map((permission) => `('${permission.Category}', '${permission.Resource}', '${permission.Operation}')`).join(',');

	const insertPermissionsSQL = `INSERT INTO Permission (Category, Resource, Operation) VALUES ${permissionsSQL};`;

	const firstId = ((
		await insertWithAssertion(MySqlClientInstance.writePool, insertPermissionsSQL, undefined, 'Failed INSERT Permissions', permissions.length)
	).results as OkPacket).insertId;

	for (let i = 0; i < permissions.length; i++) {
		permissions[i].ID = firstId + i;
	}
}

async function createEnvRoles(): Promise<void> {
	Logger.debug('Creating ENV Roles...');

	return new Promise<void>((resolve, reject) => {
		const roles = Object.values(TEST_ENV.roles);

		const rolesSQL = roles.map((role) => `('${role.Name}')`).join(',');

		const insertRolesSQL = `INSERT IGNORE INTO Role (Name) VALUES ${rolesSQL};`;

		MySqlClientInstance.writePool.query(insertRolesSQL, (err, results: OkPacket) => {
			if (err) {
				return reject(err);
			}

			if (results.insertId && results.affectedRows !== 0) {
				for (let i = 0; i < roles.length; i++) {
					roles[i].ID = results.insertId + i;
				}
			}

			return resolve();
		});
	});
}

async function createEnvUserGroups(): Promise<void> {
	Logger.debug('Creating ENV User Groups...');

	const userGroups = Object.values(TEST_ENV.userGroups);

	const userGroupsSQL = userGroups.map((userGroup) => `('${userGroup.Name}')`).join(',');

	const insertUserGroupsSQL = `INSERT INTO UserGroup (Name) VALUES ${userGroupsSQL};`;

	const firstId = ((await insertWithAssertion(MySqlClientInstance.writePool, insertUserGroupsSQL, undefined, 'Failed INSERT user Groups', userGroups.length))
		.results as OkPacket).insertId;

	for (let i = 0; i < userGroups.length; i++) {
		userGroups[i].ID = firstId + i;
	}
}

function createEnvResources(resourceTypes: Set<ResourceType>): Promise<any> {
	const createResourcePromises: Array<Promise<void>> = [];

	resourceTypes.forEach((resourceType) => createResourcePromises.push(ENV_RESOURCE_CREATORS[resourceType]()));
	resourceTypes.clear();

	return Promise.all(createResourcePromises);
}

export { TEST_ENV, TEST_ENV_STATS, HashingAlgorithms, Roles, createEnvResources };
