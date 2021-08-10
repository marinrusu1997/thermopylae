/**
 * Names of the authentication steps.
 */
export const enum AuthenticationStepName {
	/**
	 * This is an internal step used only by the library to decide which authentication step is the next one.
	 */
	DISPATCH = 'DISPATCH',
	/**
	 * Password verification step. This is the first step in the password authentication method. <br/>
	 * This step will be sent to client in case password verification failed so that it sends another valid password.
	 */
	PASSWORD = 'PASSWORD',
	/**
	 * This is an internal step used only by the library to generate 2fa token and send it to client via side channel.
	 */
	GENERATE_2FA_TOKEN = 'GENERATE_2FA_TOKEN',
	/**
	 * Two factor authentication code check. <br/>
	 * This step will be sent to client after 2fa token has been generated.
	 */
	TWO_FACTOR_AUTH_CHECK = 'TWO_FACTOR_AUTH_CHECK',
	/**
	 * This is an internal step used only by the library to generate *nonce* needed by password-less authentication.
	 */
	GENERATE_CHALLENGE = 'GENERATE_CHALLENGE',
	/**
	 * Challenge response verification step. <br/>
	 * This step will be sent to client after *nonce* has been generated.
	 */
	CHALLENGE_RESPONSE = 'CHALLENGE_RESPONSE',
	/**
	 * Recaptcha validation step. <br/>
	 * This step will be sent to client when incorrect password has been submitted more than {@link AuthenticationEngineThresholdsOptions.failedAuthAttemptsRecaptcha} times.
	 */
	RECAPTCHA = 'RECAPTCHA',
	/**
	 * This is an internal step used only by the library to detect authentication successful completion
	 * and cleanup data structures associated with authentication process, which are {@link AuthenticationSession} and {@link FailedAuthenticationAttemptSession}.
	 */
	AUTHENTICATED = 'AUTHENTICATED',
	/**
	 * This is an internal step used only by the library to detect authentication failure.
	 */
	ERROR = 'ERROR',
	/**
	 * This is an internal step used only by the library to detect authentication process misconfigurations.
	 */
	UNKNOWN = 'UNKNOWN'
}

/**
 * User account availability status.
 */
export const enum AccountStatus {
	/**
	 * Account is enabled and can be used.
	 */
	ENABLED = 0,
	/**
	 * Account has been recently registered and is disabled until user will activate it.
	 */
	DISABLED_UNTIL_ACTIVATION = -1
}
