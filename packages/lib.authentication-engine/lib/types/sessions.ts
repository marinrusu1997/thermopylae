export interface OnGoingAuthenticationSession {
	recaptchaRequired: boolean;
	mfaToken?: string; // preventing replay attacks
	challengeResponseNonce?: string; // preventing replay attacks
}

export interface FailedAuthenticationAttemptSession {
	detectedAt: Date;
	ip: string;
	device: string;
	counter: number;
}

export interface ActivateAccountSession {
	taskId: string; // scheduleDeletion unactivated account task id
	accountId: string;
}

export interface ForgotPasswordSession {
	accountId: string;
	accountRole?: string;
}
