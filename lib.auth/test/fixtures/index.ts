import LoggerInstance from '@marin/lib.logger';
import { after, afterEach, before } from 'mocha';
import FormattingManager from '@marin/lib.logger/lib/formatting/formatting-manager';
import { defaultJwtInstance, rolesTtlMap } from './jwt';
import {
	AccessPointEntityMongo,
	AccountEntityMongo,
	ActiveUserSessionEntityMongo,
	FailedAuthAttemptsEntityMongo,
	clearMongoDatabase,
	closeMongoDatabase,
	connectToMongoServer
} from './mongo-entities';
import memcache, {
	ActivateAccountSessionEntityMemCache,
	AuthSessionEntityMemCache,
	clearOperationFailuresForSessions,
	FailedAuthAttemptSessionEntityMemCache
} from './memcache-entities';
import { EmailMockInstance } from './mocks/email';
import { SmsMockInstance } from './mocks/sms';
import { AccountLockedTemplate, ActivateAccountTemplate, AuthFromDiffDeviceTemplate, MultiFactorAuthFailedTemplate, TotpTokenSmsTemplate } from './templates';
import {
	CancelScheduledUnactivatedAccountDeletionFromMongo,
	clearOperationFailuresForSchedulers,
	ScheduleActiveUserSessionDeletionFromMongo,
	ScheduleUnactivatedAccountDeletionFromMongo
} from './schedulers';

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
LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);

// trigger automatic clean up after each test (will be done at the first import)
afterEach(() =>
	clearMongoDatabase().then(() => {
		memcache.clear();
		EmailMockInstance.reset();
		SmsMockInstance.reset();
		clearOperationFailuresForSessions();
		clearOperationFailuresForSchedulers();
	})
);

// trigger global hooks at the first import in test suite files
before(() => connectToMongoServer());
after(() => closeMongoDatabase());

export default basicAuthServiceConfig;
