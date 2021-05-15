import type { HttpVerb } from '@thermopylae/core.declarations';
import type { Express } from 'express';

type EndpointOperation = 'login' | 'get_resource' | 'get_active_sessions' | 'renew_session' | 'logout' | 'logout_from_all_sessions';

const routes: Readonly<Record<EndpointOperation, { path: string; method: HttpVerb & keyof Express }>> = {
	login: {
		path: '/login',
		method: 'post'
	},
	get_resource: {
		path: '/resource',
		method: 'get'
	},
	get_active_sessions: {
		path: '/sessions',
		method: 'get'
	},
	renew_session: {
		path: '/session',
		method: 'put'
	},
	logout: {
		path: '/session',
		method: 'delete'
	},
	logout_from_all_sessions: {
		path: '/sessions',
		method: 'delete'
	}
};

export { routes };
