import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { BinaryToTextEncoding } from 'crypto';
import { RequireAtLeastOne } from '@thermopylae/core.declarations';

/**
 * Base context required by {@link AuthenticationEngine} operations.
 */
interface BaseContext {
	/**
	 * Ip from where request has been made.
	 */
	readonly ip: string;
	/**
	 * Device from where request has been made.
	 */
	readonly device?: HttpDevice;
	/**
	 * Location from where request has been made.
	 */
	readonly location?: HTTPRequestLocation;
}

/**
 * Context of the authenticate operation.
 */
interface AuthenticationContextInterface extends BaseContext {
	/**
	 * Username of the client. Needs to be given always, as it acts like an identifier.
	 */
	readonly username: string;
	/**
	 * Id of the client device.
	 * It is used as id to authentication session which links together authentication steps (e.g. password -> recaptcha -> multi factor). <br/>
	 * Usually you will either hash *User-Agent* header or {@link BaseContext.device}, or will send custom device id from your app client (which isn't always secure approach).
	 */
	readonly deviceId: string;
	/**
	 * Password of the client.
	 * This is required only for password authentication in the {@link AuthenticationStepName.PASSWORD} and {@link AuthenticationStepName.RECAPTCHA} steps. <br/>
	 * When client receives these steps as response from server, it needs to send back his password.
	 */
	readonly password?: string;
	/**
	 * Two factor authentication token.
	 * This is required only for password authentication in the {@link AuthenticationStepName.TWO_FACTOR_AUTH_CHECK} step. <br/>
	 * When client receives this step as response from server, it needs to send back his 2fa token.
	 */
	readonly '2fa-token'?: string;
	/**
	 * Perform password-less authentication using challenge-response mechanism. <br/>
	 * When given this option, library will generate a *nonce* and store it
	 * in the {@link AuthenticationStatus.token} with the {@link AuthenticationStatus.nextStep} equal to {@link AuthenticationStepName.CHALLENGE_RESPONSE}. <br/>
	 * When client receives nonce, he should encrypt it with his Private Key that is paired with Public Key stored on the server
	 * at account registration (e.g. {@link AccountModel.pubKey} this one).
	 */
	readonly generateChallenge?: boolean;
	/**
	 * Response for *nonce* sent in the {@link AuthenticationStepName.GENERATE_CHALLENGE} step. <br/>
	 * This option needs to be set only after *nonce* has been generated and sent to client.
	 */
	readonly responseForChallenge?: {
		/**
		 * Encrypted *nonce*.
		 * Will be passed to {@link ChallengeResponseValidator} as argument.
		 */
		readonly signature: string | Buffer;
		/**
		 * Algorithm used for *nonce* signing.
		 * Will be passed to {@link ChallengeResponseValidator} as argument.
		 */
		readonly signAlgorithm: string;
		/**
		 * Signature encoding.
		 * Will be passed to {@link ChallengeResponseValidator} as argument.
		 */
		readonly signEncoding: BinaryToTextEncoding;
	};
	readonly recaptcha?: string;
}
/**
 * Minimal required properties required by the authentication context.
 */
type AuthenticationContext = RequireAtLeastOne<AuthenticationContextInterface, 'password' | '2fa-token' | 'generateChallenge' | 'responseForChallenge'>;

/**
 * Context of the set two factor authentication (i.e. enable/disable mfa).
 */
interface SetTwoFactorAuthenticationContext extends BaseContext {
	/**
	 * Client password. It is needed, because this operation is a sensitive one.
	 */
	readonly password: string;
}

/**
 * Context of the change password operation.
 */
interface ChangePasswordContext extends BaseContext {
	readonly accountId: string;
	readonly oldPassword: string;
	/**
	 * New password which **needs to differ from the old one**.
	 */
	readonly newPassword: string;
}

export { BaseContext, AuthenticationContextInterface, AuthenticationContext, SetTwoFactorAuthenticationContext, ChangePasswordContext };
