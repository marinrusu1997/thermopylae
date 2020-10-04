import LoggerInstance, { FormattingManager } from '../../../lib.logger.bk';
import { string } from '@marin/lib.utils';
import { after, afterEach, before } from 'mocha';
import { defaultJwtInstance, rolesTtlMap } from './jwt';
import {
	AccountEntityMongo,
	ActiveUserSessionEntityMongo,
	AuthenticationEntryPointEntityMongo,
	clearMongoDatabase,
	clearOperationFailuresForEntities,
	closeMongoDatabase,
	connectToMongoServer,
	FailedAuthAttemptsEntityMongo
} from './mongo-entities';
import memcache, {
	ActivateAccountSessionEntityMemCache,
	AuthSessionEntityMemCache,
	clearOperationFailuresForSessions,
	FailedAuthAttemptSessionEntityMemCache,
	ForgotPasswordSessionEntityMemCache
} from './memcache-entities';
import { EmailMockInstance } from './mocks/email';
import { SmsMockInstance } from './mocks/sms';
import {
	AccountDisabledTemplate,
	ActivateAccountTemplate,
	AuthFromDiffDeviceTemplate,
	ForgotPasswordTemplateEmail,
	ForgotPasswordTemplateSms,
	MultiFactorAuthFailedTemplate,
	TotpTokenSmsTemplate
} from './templates';
import {
	CancelScheduledUnactivatedAccountDeletionFromMongo,
	cleanUpSchedulers,
	ScheduleAccountEnablingFromMongo,
	ScheduleActiveUserSessionDeletionFromMongo,
	ScheduleUnactivatedAccountDeletionFromMongo
} from './schedulers';
import { getLogger } from '../../lib/logger';
import { challengeResponseValidator, recaptchaValidator } from './validators';
import { AuthEngineOptions } from '../../lib';
import { HashingAlgorithms, PasswordHasher } from './password-hasher';

// initialize static variables
PasswordHasher.pepper = string.generateStringOfLength(10);

const basicAuthEngineConfig: AuthEngineOptions = {
	jwt: {
		instance: defaultJwtInstance,
		rolesTtl: rolesTtlMap
	},
	entities: {
		account: AccountEntityMongo,
		activeUserSession: ActiveUserSessionEntityMongo,
		activateAccountSession: ActivateAccountSessionEntityMemCache,
		accessPoint: AuthenticationEntryPointEntityMongo,
		onGoingAuthSession: AuthSessionEntityMemCache,
		failedAuthAttempts: FailedAuthAttemptsEntityMongo,
		failedAuthAttemptsSession: FailedAuthAttemptSessionEntityMemCache,
		forgotPasswordSession: ForgotPasswordSessionEntityMemCache
	},
	'side-channels': {
		email: {
			client: EmailMockInstance,
			'send-options': {
				activateAccount: {
					htmlTemplate: ActivateAccountTemplate
				},
				authenticationFromDifferentDevice: {
					htmlTemplate: AuthFromDiffDeviceTemplate
				},
				accountDisabled: {
					htmlTemplate: AccountDisabledTemplate
				},
				multiFactorAuthenticationFailed: {
					htmlTemplate: MultiFactorAuthFailedTemplate
				},
				forgotPasswordToken: {
					htmlTemplate: ForgotPasswordTemplateEmail
				}
			}
		},
		sms: {
			client: SmsMockInstance,
			'send-options': {
				totpTokenTemplate: TotpTokenSmsTemplate,
				forgotPasswordTokenTemplate: ForgotPasswordTemplateSms
			}
		}
	},
	schedulers: {
		account: {
			enable: ScheduleAccountEnablingFromMongo,
			deleteUnactivated: ScheduleUnactivatedAccountDeletionFromMongo,
			cancelDeleteUnactivated: CancelScheduledUnactivatedAccountDeletionFromMongo
		},
		deleteActiveUserSession: ScheduleActiveUserSessionDeletionFromMongo
	},
	validators: {
		recaptcha: recaptchaValidator,
		challengeResponse: challengeResponseValidator
	},
	passwordHasher: new PasswordHasher(HashingAlgorithms.BCRYPT),
	secrets: {
		totp: string.generateStringOfLength(10)
	},
	contacts: {
		adminEmail: 'admin@product.com'
	},
	tokensLength: 20
};

// since this config will be imported from all tests, it's the right place to put some initializations
LoggerInstance.console.setConfig({ level: 'emerg' }); // emerg is to supress error logs generatted by the engine
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
