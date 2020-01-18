import { HexBase64Latin1Encoding } from 'crypto';
import { BasicCredentials, BasicLocation } from './basic-types';

export type Id = number | string;

export const enum SIDE_CHANNEL {
	EMAIL = 'EMAIL',
	SMS = 'SMS'
}

export interface RegistrationRequest extends BasicCredentials {
	email: string;
	telephone: string;
	role?: string;
	pubKey?: string | Buffer;
}

export interface AuthRequest {
	username: string;
	password?: string;
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

export interface ChangePasswordRequest {
	sessionId: number;
	accountId: string;
	oldPassword: string;
	newPassword: string;
}

export interface CreateForgotPasswordSessionRequest {
	username: string;
	'side-channel': SIDE_CHANNEL;
}

export interface ChangeForgottenPasswordRequest {
	token: string;
	newPassword: string;
}
