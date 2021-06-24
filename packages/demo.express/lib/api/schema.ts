import deepFreeze from 'deep-freeze';
import type { Express } from 'express';
import type { HttpVerb } from '@thermopylae/core.declarations';

type ApiMethod =
	| 'authenticate'
	| 'register'
	| 'activateAccount'
	| 'changeMultiFactorAuthenticationStatus'
	| 'getActiveSessions'
	| 'getFailedAuthenticationAttempts'
	| 'changePassword'
	| 'createForgotPasswordSession'
	| 'changeForgottenPassword'
	| 'changeAccountStatus'
	| 'logout';

const API_SCHEMA: Record<ApiMethod, { path: string; method: HttpVerb & keyof Express; requiresNoAuthentication?: string }> = deepFreeze({
	authenticate: {
		method: 'post',
		path: '/authenticate',
		requiresNoAuthentication: '/authenticate[/]?$'
	},
	register: {
		method: 'post',
		path: '/account',
		requiresNoAuthentication: '/account[/]?$'
	},
	activateAccount: {
		method: 'post',
		path: '/account/activate',
		requiresNoAuthentication: '/account/activate[/]?$'
	},
	changeMultiFactorAuthenticationStatus: {
		method: 'put',
		path: '/multi_factor'
	},
	getActiveSessions: {
		method: 'get',
		path: '/session/user/active'
	},
	getFailedAuthenticationAttempts: {
		method: 'get',
		path: '/failed_attempts'
	},
	changePassword: {
		method: 'put',
		path: '/account/password'
	},
	createForgotPasswordSession: {
		method: 'post',
		path: '/session/forgot_password',
		requiresNoAuthentication: '/session/forgot_password[/]?$'
	},
	changeForgottenPassword: {
		method: 'put',
		path: '/account/password/forgotten',
		requiresNoAuthentication: '/account/password/forgotten[/]?$'
	},
	changeAccountStatus: {
		method: 'put',
		path: '/account/status'
	},
	logout: {
		method: 'delete',
		path: '/session/user'
	}
});

export { API_SCHEMA };
