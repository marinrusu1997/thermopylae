import { BasicCredentials, BasicLocation } from './basic-types';

export interface AccountModel extends BasicCredentials {
	id?: string;
	hashingAlg: number;
	salt: string;
	email: string; // @fixme it might be the same as username
	telephone: string;
	enabled: boolean;
	usingMfa: boolean;
	role?: string; // @fixme should disappear
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

// @fixme should also be removed, it deals with session not with auth
export interface ActiveUserSession {
	authenticatedAtUNIX: number; // UNIX seconds
	accountId: string;
	// https://security.stackexchange.com/questions/170388/do-i-need-csrf-token-if-im-using-bearer-jwt
}

// @fixme take a look that this one can also be saved into JWT by the repository implementation
export interface FailedAuthAttemptsModel {
	id?: string;
	accountId: string;
	detectedAt: Date;
	device: string;
	ip: string;
}
