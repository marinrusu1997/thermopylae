import { BasicCredentials, Id } from '../types';

export interface Account extends BasicCredentials {
	id?: string;
	salt: string;
	role: string;
	email: string;
	mobile: string;
	activated: boolean;
	locked: boolean;
	mfa: boolean;
}

export interface AccessPoint {
	id: number;
	accountId: Id;
	ip: string;
	device: string;
	location: string;
}

export interface FailedAuthAttempts {
	id?: number;
	accountId: Id;
	timestamp: number;
	devices: string;
	ips: string;
}
