import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/cookie/avro.js';
import { UserSessionManager } from '@thermopylae/lib.user-session';
import type { CookieUserSessionMiddlewareOptions } from '../../lib/index.js';
import { CookieUserSessionMiddleware, UserSessionRedisStorage } from '../../lib/index.js';
import { logger } from '../../lib/logger.js';

const options: CookieUserSessionMiddlewareOptions = {
	sessionManager: {
		idLength: 18,
		sessionTtl: 5,
		timeouts: {
			idle: 3,
			renewal: 2,
			oldSessionAvailabilityAfterRenewal: 1
		},
		renewSessionHooks: {
			onRenewMadeAlreadyFromCurrentProcess(sessionId: string) {
				logger.warning(
					`Can't renew session '${UserSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from this NodeJS process.`
				);
			},
			onRenewMadeAlreadyFromAnotherProcess(sessionId: string) {
				logger.warning(
					`Can't renew session '${UserSessionManager.hash(
						sessionId
					)}', because it was renewed already. Renew has been made from another NodeJS process.`
				);
			},
			onOldSessionDeleteFailure(sessionId: string, e: Error) {
				logger.error(`Failed to delete renewed session '${UserSessionManager.hash(sessionId)}'.`, e);
			}
		},
		storage: new UserSessionRedisStorage({
			keyPrefix: {
				sessions: 'sids',
				sessionId: 'sid'
			},
			concurrentSessions: 2,
			serializer: AVRO_SERIALIZER
		})
	},
	session: {
		cookie: {
			name: 'sid',
			path: '/api',
			sameSite: 'strict',
			persistent: true
		},
		header: 'x-session-id',
		csrf: {
			name: 'x-requested-with',
			value: 'XmlHttpRequest'
		},
		'cache-control': true
	}
};

const middleware = new CookieUserSessionMiddleware(options);

export { middleware, options };
