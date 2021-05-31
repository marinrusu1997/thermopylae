import type { HttpDevice, UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * Session which holds the current authentication made by user from a concrete device
 * (i.e. these sessions are device based, usually by 'User-Agent' when using HTTP interface).
 */
interface AuthenticationSession {
	recaptchaRequired?: boolean;
	'2fa-token'?: string; // preventing replay attacks
	challengeResponseNonce?: string; // preventing replay attacks
}

/**
 * Session which stores failed authentication attempts for the whole account
 * no matter from which device authentication is made. <br/>
 * On the successful authentication, this session needs to be deleted.
 */
interface FailedAuthenticationAttemptSession {
	detectedAt: UnixTimestamp;
	ip: string;
	device?: HttpDevice;
	counter: number;
}

interface ForgotPasswordSession {
	accountId: string;
}

export type { AuthenticationSession, FailedAuthenticationAttemptSession, ForgotPasswordSession };
