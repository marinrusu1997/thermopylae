// eslint-disable-next-line import/extensions
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/cookie/avro';
import type { CookieUserSessionMiddlewareOptions } from '../../lib';
import { logger } from '../../lib/logger';
import { CookieUserSessionMiddleware, UserSessionRedisStorage } from '../../lib';

const options: CookieUserSessionMiddlewareOptions = {
	sessionManager: {
		idLength: 18,
		sessionTtl: 3,
		timeouts: {
			idle: 1,
			renewal: 2,
			oldSessionAvailabilityTimeoutAfterRenewal: 1
		},
		logger,
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
