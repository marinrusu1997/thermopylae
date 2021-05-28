import { Encoding } from 'crypto';
import { BasicCredentials, BasicLocation } from './basic-types';

export const enum SIDE_CHANNEL {
	EMAIL = 'EMAIL',
	SMS = 'SMS'
}

// @fixme this needs to be a template, so that they can register whatever info they want
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
	device: string; // @fixme (optional) replace with http device
	location: BasicLocation; // @fixme (optional) replace with location from core
	totp?: string;
	recaptcha?: string;
	generateChallenge?: boolean;
	responseForChallenge?: {
		signature: string | Buffer;
		signAlgorithm: string;
		signEncoding: Encoding;
	};
}

export interface ChangePasswordRequest {
	sessionId: number;
	accountId: string;
	old: string;
	new: string;
	logAllOtherSessionsOut?: boolean;
}

export interface CreateForgotPasswordSessionRequest {
	username: string;
	'side-channel': SIDE_CHANNEL;
}

export interface ChangeForgottenPasswordRequest {
	token: string;
	newPassword: string;
}
