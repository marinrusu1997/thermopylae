export interface ActiveUserSession {
	timestamp: number;
	accountId: string;
	// https://security.stackexchange.com/questions/170388/do-i-need-csrf-token-if-im-using-bearer-jwt
}

export interface AuthSession {
	recaptchaRequired: boolean;
	mfaToken?: string; // preventing replay attacks
}

export interface FailedAuthAttemptSession {
	timestamp: number;
	ip: Array<string>;
	device: Array<string>;
	counter: number;
}

export interface ActivateAccountSession {
	taskId: string; // delete unactivated account task id
	accountId: string;
}
