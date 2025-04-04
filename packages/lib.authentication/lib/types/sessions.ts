import type { HTTPRequestLocation, HttpDevice, UnixTimestamp } from '@thermopylae/core.declarations';

/** Session which holds the current authentication made by user from a concrete device. */
interface AuthenticationSession {
	/**
	 * Whether recaptcha is required in order to complete authentication. <br/> After recaptcha has
	 * been verified, this property will be removed from session.
	 */
	recaptchaRequired?: boolean;
	/**
	 * Two factor authentication token that was generated and sent to client. <br/> After it has
	 * been validated, it will removed from session, in order to prevent [replay
	 * attacks](https://en.wikipedia.org/wiki/Replay_attack).
	 */
	twoFactorAuthenticationToken?: string; // preventing replay attacks
	/**
	 * Challenge Response nonce that was generated and sent to client. <br/> After it has been
	 * validated, it will removed from session, in order to prevent [replay
	 * attacks](https://en.wikipedia.org/wiki/Replay_attack).
	 */
	challengeResponseNonce?: string; // preventing replay attacks
}

/**
 * Session which stores failed authentication attempts for the whole account, no matter from which
 * device failed authentication has been made. <br/> On the successful authentication, this session
 * needs to be deleted. <br/> This session is mainly used to detect [brute force
 * attack](https://en.wikipedia.org/wiki/Brute-force_attack) and employ some form of protection
 * (recaptcha & account disabling for some amount of time).
 */
interface FailedAuthenticationAttemptSession {
	/** When attempt has been detected. */
	detectedAt: UnixTimestamp;
	/** Ip from where authentication has been made. */
	ip: string;
	/** Device from where authentication has been made. */
	device?: HttpDevice | null;
	/** Location from where authentication has been made. */
	location?: HTTPRequestLocation | null;
	/**
	 * Number of failed authentication attempts detected. <br/> Each time a new attempt is detected,
	 * this counter gets incremented.
	 */
	counter: number;
}

export type { AuthenticationSession, FailedAuthenticationAttemptSession };
