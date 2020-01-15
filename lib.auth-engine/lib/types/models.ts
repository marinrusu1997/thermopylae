import { BasicCredentials, BasicLocation } from './basic-types';

export interface AccountModel extends BasicCredentials {
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

export interface AccessPointModel {
	timestamp: number;
	accountId: string;
	ip: string;
	device: string;
	location: BasicLocation;
}

export interface FailedAuthAttemptsModel {
	id?: string;
	accountId: string;
	timestamp: number;
	devices: Set<string>;
	ips: Set<string>;
}
