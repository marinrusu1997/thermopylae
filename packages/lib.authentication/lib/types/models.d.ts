import { BasicCredentials, BasicLocation } from './basic-types';
import { MFAOperation } from './enums';

export interface AccountModel extends BasicCredentials {
	id?: string;
	alg: number;
	salt: string;
	email: string;
	telephone: string;
	enabled: boolean;
	mfa: MFAOperation;
	pubKey?: string | Buffer;
}

// @fixme user session, should be removed from this lib, and maybe put into core.package
export interface AuthenticationEntryPointModel {
	authenticatedAtUNIX: number; // UNIX seconds
	accountId: string;
	ip: string;
	device: string;
	location: BasicLocation;
}

export interface FailedAuthAttemptsModel {
	id?: string;
	accountId: string;
	detectedAt: Date;
	device: string;
	ip: string;
}
