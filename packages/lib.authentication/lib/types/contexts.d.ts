import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { Encoding } from 'crypto';

interface BaseContext {
	ip: string;
	device?: HttpDevice;
	location?: HTTPRequestLocation;
}

interface AuthenticationContext extends BaseContext {
	username: string;
	password?: string;
	deviceId: string;
	'2fa-token'?: string;
	recaptcha?: string;
	generateChallenge?: boolean;
	responseForChallenge?: {
		signature: string | Buffer;
		signAlgorithm: string;
		signEncoding: Encoding;
	};
}

type ChangePasswordContext = BaseContext;

export { AuthenticationContext, ChangePasswordContext };
