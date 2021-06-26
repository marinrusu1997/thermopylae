import deepFreeze from 'deep-freeze';
import { ApiSchema } from '../../../typings';

type ApiMethod =
	| 'authenticate'
	| 'register'
	| 'activateAccount'
	| 'setTwoFactorAuthEnabled'
	| 'getFailedAuthentications'
	| 'getSuccessfulAuthentications'
	| 'changePassword'
	| 'createForgotPasswordSession'
	| 'changeForgottenPassword';

const API_SCHEMA: ApiSchema<ApiMethod> = deepFreeze({
	authenticate: {
		verb: 'post',
		path: '/authenticate',
		requiresSession: false
	},
	register: {
		verb: 'post',
		path: '/register',
		requiresSession: false
	},
	activateAccount: {
		verb: 'put',
		path: '/account/activate',
		requiresSession: false
	},
	setTwoFactorAuthEnabled: {
		verb: 'put',
		path: '/two/factor',
		requiresSession: true
	},
	getFailedAuthentications: {
		verb: 'get',
		path: '/failed/attempts',
		requiresSession: true
	},
	getSuccessfulAuthentications: {
		verb: 'get',
		path: '/successful/attempts',
		requiresSession: true
	},
	changePassword: {
		verb: 'put',
		path: '/account/password',
		requiresSession: true
	},
	createForgotPasswordSession: {
		verb: 'post',
		path: '/forgot/password/session',
		requiresSession: false
	},
	changeForgottenPassword: {
		verb: 'put',
		path: '/account/password/forgotten',
		requiresSession: false
	}
});

export { API_SCHEMA };
