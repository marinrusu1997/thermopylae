import { faker } from '@faker-js/faker';
import {
	AccountStatus,
	type AccountWithTotpSecret,
	type FailedAuthenticationAttemptSession,
	type FailedAuthenticationModel,
	type SuccessfulAuthenticationModel
} from '@thermopylae/lib.authentication';
import { chrono, type types } from '@thermopylae/lib.utils';
import DeviceDetectorJs, { type DeviceDetectorResult } from 'device-detector-js';
import randomItem from 'random-item';
import { objectEntries } from 'tsafe';

interface FilteringOptions<T> {
	nullify?: readonly (keyof T)[];
	delete?: readonly (keyof T)[];
	include?: Partial<T>;
}

function randomDisabledUntil(): number {
	return randomItem([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unix()]);
}

function filterer<T extends object>(record: T, options?: FilteringOptions<T>): T {
	const include: FilteringOptions<T>['include'] = options?.include ?? {};
	const nullify = options?.nullify ?? [];
	const deletes = options?.delete ?? [];

	for (const [key, value] of objectEntries(include)) {
		record[key] = value as T[keyof T];
	}

	for (const field of nullify) {
		record[field] = (field === 'id' ? undefined : null) as types.Any;
	}

	for (const field of deletes) {
		// oxlint-disable-next-line no-dynamic-delete
		delete record[field];
	}

	return record;
}

function generateAccount(options?: FilteringOptions<AccountWithTotpSecret>): AccountWithTotpSecret {
	return filterer(
		{
			id: faker.string.uuid(),
			username: faker.internet.username(),
			passwordHash: faker.internet.password({ length: 12 }),
			passwordSalt: faker.string.sample({ min: 10, max: 20 }),
			passwordAlg: faker.number.int({ min: 0, max: 9 }),
			email: faker.internet.email(),
			telephone: faker.phone.number({ style: 'international' }),
			disabledUntil: randomDisabledUntil(),
			mfa: faker.datatype.boolean(),
			totpSecret: faker.string.sample({ min: 10, max: 20 }),
			pubKey: faker.string.alphanumeric({ length: 20 })
		},
		options
	);
}

function generateLocation(): FailedAuthenticationModel['location'] {
	return {
		countryCode: faker.location.countryCode(),
		regionCode: faker.location.state(),
		city: faker.location.city(),
		timezone: faker.location.timeZone(),
		longitude: faker.location.longitude(),
		latitude: faker.location.latitude()
	};
}

const DEVICE_DETECTOR = new DeviceDetectorJs();
const USER_AGENTS = Object.freeze([
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
	'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:97.0) Gecko/20100101 Firefox/97.0',
	'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:97.0) Gecko/20100101 Firefox/97.0',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Edg/98.0.1108.62',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Edg/98.0.1108.62',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36'
]);
function generateDevice(userAgent?: string): DeviceDetectorResult {
	userAgent = userAgent ?? randomItem(USER_AGENTS);

	const device = DEVICE_DETECTOR.parse(userAgent);
	if (!device) {
		throw new Error(`Failed to parse device from user agent: ${userAgent}`);
	}
	return device;
}

function generateFailedAuthenticationModel(account: AccountWithTotpSecret, options?: FilteringOptions<FailedAuthenticationModel>): FailedAuthenticationModel {
	return filterer(
		{
			id: faker.string.uuid(),
			accountId: account.id,
			ip: faker.internet.ip(),
			device: Math.random() > 0.5 ? generateDevice() : null,
			location: Math.random() < 0.5 ? generateLocation() : null,
			detectedAt: chrono.unix()
		},
		options
	);
}

function generateFailedAuthenticationAttemptSession(options?: FilteringOptions<FailedAuthenticationAttemptSession>): FailedAuthenticationAttemptSession {
	return filterer(
		{
			detectedAt: chrono.unix(),
			ip: faker.internet.ip(),
			counter: 1
		},
		options
	);
}

function generateSuccessfulAuthenticationModel(
	account: AccountWithTotpSecret,
	options?: FilteringOptions<SuccessfulAuthenticationModel>
): SuccessfulAuthenticationModel {
	return filterer(
		{
			id: faker.string.uuid(),
			accountId: account.id,
			ip: faker.internet.ip(),
			device: Math.random() > 0.5 ? generateDevice() : null,
			location: Math.random() < 0.5 ? generateLocation() : null,
			authenticatedAt: chrono.unix()
		},
		options
	);
}

export {
	generateAccount,
	randomDisabledUntil,
	generateFailedAuthenticationModel,
	generateLocation,
	generateDevice,
	generateFailedAuthenticationAttemptSession,
	generateSuccessfulAuthenticationModel
};
