import { models } from '@marin/lib.authentication-engine';

export enum ResourceType {
	ACCOUNT = 'ACCOUNT',
	DEVICE = 'DEVICE',
	LOCATION = 'LOCATION',
	PERMISSION = 'PERMISSION',
	ROLE = 'ROLE',
	USER_GROUP = 'USER_GROUP'
}

export const enum Roles {
	USER = 'USER',
	MODERATOR = 'MODERATOR',
	MANAGER = 'MANAGER',
	CUSTOMER = 'CUSTOMER'
}

export const enum HashingAlgorithms {
	BCRYPT = 1,
	ARGON2 = 2
}

export interface Device {
	ID: string;
	OperatingSystem: string | null;
	Platform: string | null;
	Browser: string | null;
	Version: string | null;
	Source: string | null;
}

export interface Location {
	ID: string;
	CountryCode: string | null;
	RegionCode: string | null;
	City: string | null;
	TimeZone: string | null;
	Latitude: number | null;
	Longitude: number | null;
	PostalCode: string | null;
}

export interface Permission {
	ID: number;
	readonly Category: string;
	readonly Resource: string;
	readonly Operation: string;
}

export interface Role {
	ID: number;
	readonly Name: string;
}

export interface UserGroup {
	ID: number;
	readonly Name: string;
}

interface Account {
	owner: models.AccountModel;
	firstLinkedUserId: string;
}

interface EnvAccounts {
	firstAccount: Readonly<Account>;
	secondAccount: Readonly<Account>;
}

interface EnvDevices {
	ANDROID: Readonly<Device>;
	IOS: Readonly<Device>;
}

interface EnvLocations {
	RO: Readonly<Location>;
	MD: Readonly<Location>;
}

interface EnvRoles {
	USER: Role;
	MODERATOR: Role;
	MANAGER: Role;
	CUSTOMER: Role;
}

interface EnvPermissions {
	CHAT: Permission;
	ACCOUNTING: Permission;
}

interface EnvUserGroups {
	USERS: UserGroup;
	MODERATORS: UserGroup;
	MANAGERS: UserGroup;
	CUSTOMERS: UserGroup;
}

export interface TestsEnvironment {
	accounts: Readonly<EnvAccounts>;
	roles: Readonly<EnvRoles>;
	devices: Readonly<EnvDevices>;
	locations: Readonly<EnvLocations>;
	permissions: Readonly<EnvPermissions>;
	userGroups: Readonly<EnvUserGroups>;
}

export interface TestsEnvironmentStats {
	RESOURCES: Readonly<{
		ACCOUNT_NO: number;
		USERS_NO: number;
		ROLES_NO: number;
		PERMISSIONS_NO: number;
		DEVICES_NO: number;
		LOCATIONS_NO: number;
		USER_GROUPS_NO: number;
	}>;

	FIRST_ACCOUNT: {
		OWNER_USER: {
			CONTACTS_NO: number;
		};
		LINKED_USER: {
			CONTACTS_NO: number;
		};
	};

	SECOND_ACCOUNT: {
		OWNER_USER: {
			CONTACTS_NO: number;
		};
		LINKED_USER: {
			CONTACTS_NO: number;
		};
	};
}

export const SAFE_MYSQL_CHAR_REGEX = /[a-zA-Z0-9>!@#$%^&*()_+=-}{[\]:;"\\|?/.<,`~]/;

export function getAllResourceTypes(): Set<ResourceType> {
	return new Set<ResourceType>([
		ResourceType.ACCOUNT,
		ResourceType.DEVICE,
		ResourceType.LOCATION,
		ResourceType.PERMISSION,
		ResourceType.ROLE,
		ResourceType.USER_GROUP
	]);
}
