import type { Exception } from '@thermopylae/lib.exception';
import type { AccountModel } from '../types/models';
import type { AuthenticationStepName } from '../types/enums';
import type { AuthenticationSessionRepositoryHolder } from '../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../types/contexts';

/**
 * Authentication status returned by {@link AuthenticationEngine}.
 */
interface AuthenticationStatus<Account extends AccountModel> {
	/**
	 * Token which needs to be sent to client. <br/>
	 * For now, this property is set only by challenge-response nonce generator.
	 */
	token?: string;
	/**
	 * Next step in the authentication process.
	 */
	nextStep?: AuthenticationStepName;
	/**
	 * Error encountered in the authentication process.
	 */
	error?: {
		/**
		 * Hard error encountered, account was disabled and authentication needs to be aborted.
		 */
		hard?: Exception;
		/**
		 * Soft error encountered. Client can contain authentication from the {@link AuthenticationStatus.nextStep}.
		 */
		soft?: Exception;
	};
	/**
	 * Property set only when authentication is completed successfully.
	 * Contains user account model.
	 */
	authenticated?: Account;
}

/**
 * @private
 */
interface AuthenticationStepOutput<Account extends AccountModel> {
	nextStep?: AuthenticationStepName;
	done?: AuthenticationStatus<Account>;
}

/**
 * @private
 */
interface AuthenticationStep<Account extends AccountModel> {
	process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder,
		previousAuthenticationStepName: AuthenticationStepName
	): Promise<AuthenticationStepOutput<Account>>;
}

export { AuthenticationStatus, AuthenticationStepOutput, AuthenticationStep };
