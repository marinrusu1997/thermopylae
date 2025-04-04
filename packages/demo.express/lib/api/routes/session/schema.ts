import type { ApiSchema } from '../../../typings.js';

type ApiMethod = 'refreshUserSession' | 'getActiveUserSessions' | 'logout' | 'logoutOne' | 'logoutAll';

const API_SCHEMA: ApiSchema<ApiMethod> = {
	refreshUserSession: {
		verb: 'put',
		path: '/refresh',
		requiresSession: false
	},
	getActiveUserSessions: {
		verb: 'get',
		path: '/active',
		requiresSession: true
	},
	logout: {
		verb: 'delete',
		path: '/logout',
		requiresSession: true
	},
	logoutOne: {
		verb: 'delete',
		path: '/logout/one',
		requiresSession: true
	},
	logoutAll: {
		verb: 'delete',
		path: '/logout/all',
		requiresSession: true
	}
};

export { API_SCHEMA };
