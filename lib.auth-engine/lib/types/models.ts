import { BasicCredentials, BasicLocation } from './basic-types';

export interface AccountModel extends BasicCredentials {
	id?: string;
	salt: string;
	email: string;
	telephone: string;
	enabled: boolean;
	usingMfa: boolean;
	role?: string;
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
	devices: Array<string>;
	ips: Array<string>;
}
