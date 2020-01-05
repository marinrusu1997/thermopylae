import LoggerInstance, { FormattingManager } from '@marin/lib.logger';
import { after, afterEach, before } from 'mocha';
import { defaultJwtInstance, rolesTtlMap } from './jwt';
import {
	AccessPointEntityMongo,
	AccountEntityMongo,
	ActiveUserSessionEntityMongo,
	FailedAuthAttemptsEntityMongo,
	clearMongoDatabase,
	closeMongoDatabase,
	connectToMongoServer,
	clearOperationFailuresForEntities
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
	cleanUpSchedulers,
	ScheduleActiveUserSessionDeletionFromMongo,
	ScheduleUnactivatedAccountDeletionFromMongo
} from './schedulers';
import { getLogger } from '../../lib/logger';
import { challengeResponseValidator, recaptchaValidator } from './validators';

const basicAuthEngineConfig = {
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
	validators: {
		recaptcha: recaptchaValidator,
		challengeResponse: challengeResponseValidator
	},
	secrets: {
		pepper: 'pepper',
		totp: 'totp'
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
LoggerInstance.console.setConfig({ level: 'debug' }); // emerg is to supress error logs generatted by the engine
LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);

// trigger automatic clean up after each test (will be done at the first import)
afterEach(() =>
	clearMongoDatabase()
		.then(() => {
			memcache.clear();
			EmailMockInstance.reset();
			SmsMockInstance.reset();
			clearOperationFailuresForEntities();
			clearOperationFailuresForSessions();
			cleanUpSchedulers();
		})
		.catch(err => getLogger().error('Failed to clean up resources', err))
);

// trigger global hooks at the first import in test suite files
before(() => connectToMongoServer());
after(() => closeMongoDatabase());

export default basicAuthEngineConfig;
