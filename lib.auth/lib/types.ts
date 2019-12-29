export type Id = number | string;

export interface BasicCredentials {
	username: string;
	password: string;
}

export interface AuthNetworkInput {
	username: string;
	password: string;
	ip: string;
	device: string;
	location: string;
	totp?: string;
	recaptcha?: string;
}

export type ScheduleDeletionUserSession = (sessionId: number, whenToDelete: number) => void;
