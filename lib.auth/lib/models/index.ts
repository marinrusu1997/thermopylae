import { BasicCredentials } from '../types';

export interface Account extends BasicCredentials {
	id?: string;
	salt: string;
	role?: string;
	email: string;
	mobile: string;
	activated: boolean;
	locked: boolean;
	mfa: boolean;
}

export interface AccessPoint {
	id: number;
	accountId: string;
	ip: string;
	device: string;
	location: string;
}

export interface FailedAuthAttempts {
	id?: string;
	accountId: string;
	timestamp: number;
	devices: string;
	ips: string;
}
