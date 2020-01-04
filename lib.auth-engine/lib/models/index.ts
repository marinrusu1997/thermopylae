import { BasicCredentials, BasicLocation } from '../types';

export interface Account extends BasicCredentials {
	id?: string;
	salt: string;
	role?: string;
	email: string;
	telephone: string;
	activated: boolean;
	locked: boolean;
	mfa: boolean;
	pubKey?: string | Buffer;
}

export interface AccessPoint {
	timestamp: number;
	accountId: string;
	ip: string;
	device: string;
	location: BasicLocation;
}

export interface FailedAuthAttempts {
	id?: string;
	accountId: string;
	timestamp: number;
	devices: Set<string>;
	ips: Set<string>;
}
