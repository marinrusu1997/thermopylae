enum AUTH_STEP {
	DISPATCH = 'dispatch',
	SECRET = 'secret',
	GENERATE_TOTP = 'generate-totp',
	TOTP = 'totp',
	RECAPTCHA = 'recaptcha',
	AUTHENTICATED = 'authenticated',
	ERROR = 'error'
}

export { AUTH_STEP };
