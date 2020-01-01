import LoggerInstance from '@marin/lib.logger';
import { defaultJwtInstance, rolesTtlMap } from './jwt';
import { AccessPointEntityMongo, AccountEntityMongo, ActiveUserSessionEntityMongo, FailedAuthAttemptsEntityMongo } from './mongo-entities';
import { ActivateAccountSessionEntityMemCache, AuthSessionEntityMemCache, FailedAuthAttemptSessionEntityMemCache } from './memcache-entities';
import { EmailMockInstance } from './mocks/email';
import { SmsMockInstance } from './mocks/sms';
import { AccountLockedTemplate, ActivateAccountTemplate, AuthFromDiffDeviceTemplate, MultiFactorAuthFailedTemplate, TotpTokenSmsTemplate } from './templates';
import { CancelScheduledUnactivatedAccountDeletionFromMongo, ScheduleActiveUserSessionDeletionFromMongo, ScheduleUnactivatedAccountDeletionFromMongo } from './schedulers';

const basicAuthServiceConfig = {
	jwt: {
		instance: defaultJwtInstance,
		rolesTtl: rolesTtlMap
	},
	entities: {
		account: AccountEntityMongo,
		activeUserSession: ActiveUserSessionEntityMongo,
		activateAccountSession: ActivateAccountSessionEntityMemCache,
		accessPoint: AccessPointEntityMongo,
		authSession: AuthSessionEntityMemCache,
		failedAuthAttempts: FailedAuthAttemptsEntityMongo,
		failedAuthAttemptsSession: FailedAuthAttemptSessionEntityMemCache
	},
	'side-channels': {
		email: EmailMockInstance,
		sms: SmsMockInstance
	},
	templates: {
		totpTokenSms: TotpTokenSmsTemplate,
		activateAccount: ActivateAccountTemplate,
		authFromDiffDevice: AuthFromDiffDeviceTemplate,
		accountLocked: AccountLockedTemplate,
		multiFactorAuthFailed: MultiFactorAuthFailedTemplate
	},
	schedulers: {
		account: {
			deleteUnactivated: ScheduleUnactivatedAccountDeletionFromMongo,
			cancelDelete: CancelScheduledUnactivatedAccountDeletionFromMongo
		},
		deleteActiveUserSession: ScheduleActiveUserSessionDeletionFromMongo
	},
	secrets: {
		pepper: 'pepper',
		totp: 'totp',
		recaptcha: 'recaptcha'
	},
	contacts: {
		adminEmail: 'admin@product.com'
	},
	sizes: {
		token: 20,
		salt: 10
	}
};

// since this config will be imported from all tests, it's the right place to put some initializations
LoggerInstance.console.setConfig({ level: 'debug' });

export default basicAuthServiceConfig;
