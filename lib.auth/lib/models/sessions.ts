export interface ActiveUserSession {
	id: number;
	accountId: string;
	// https://security.stackexchange.com/questions/170388/do-i-need-csrf-token-if-im-using-bearer-jwt
}

export interface AuthSession {
	recaptchaRequired: boolean;
}

export interface FailedAuthAttemptSession {
	timestamp: number;
	ip: Array<string>;
	device: Array<string>;
	counter: number;
}
