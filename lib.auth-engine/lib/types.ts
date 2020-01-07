import { HexBase64Latin1Encoding } from 'crypto';

export type Id = number | string;

export interface BasicCredentials {
	username: string;
	password: string;
}

export interface BasicRegistrationInfo extends BasicCredentials {
	email: string;
	telephone: string;
	role?: string;
	pubKey?: string | Buffer;
}

export interface BasicLocation {
	countryCode: string;
	regionCode: string;
	city: string;
	timeZone: string | object;
	latitude: number;
	longitude: number;
	postalCode?: string;
}

export interface AuthInput {
	username: string;
	password: string;
	ip: string;
	device: string;
	location: BasicLocation;
	totp?: string;
	recaptcha?: string;
	generateChallenge?: boolean;
	responseForChallenge?: {
		signature: string | Buffer;
		signAlgorithm: string;
		signEncoding: HexBase64Latin1Encoding;
	};
}

export interface ChangePasswordInput {
	accountId: string;
	oldPassword: string;
	newPassword: string;
}
