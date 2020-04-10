import { BasicCredentials, BasicLocation } from './basic-types';

export interface AccountModel extends BasicCredentials {
	id?: string;
	hashingAlg: number;
	salt: string;
	email: string;
	telephone: string;
	enabled: boolean;
	usingMfa: boolean;
	role?: string;
	pubKey?: string | Buffer;
}

export interface AuthenticationEntryPointModel {
	authenticatedAtUNIX: number; // UNIX seconds
	accountId: string;
	ip: string;
	device: string;
	location: BasicLocation;
}

export interface ActiveUserSession {
	authenticatedAtUNIX: number; // UNIX seconds
	accountId: string;
	// https://security.stackexchange.com/questions/170388/do-i-need-csrf-token-if-im-using-bearer-jwt
}

export interface FailedAuthAttemptsModel {
	id?: string;
	accountId: string;
	detectedAt: Date;
	device: string;
	ip: string;
}
