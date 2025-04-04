import type { Exception } from '@thermopylae/lib.exception';
import type { AuthenticationSessionRepositoryHolder } from '../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../types/contexts.js';
import type { AuthenticationStepName } from '../types/enums.js';
import type { AccountModel } from '../types/models.js';

/** Error encountered in the authentication process. */
interface AuthenticationStatusError {
	/** Hard error encountered, account was disabled and authentication needs to be aborted. */
	hard?: Exception;
	/**
	 * Soft error encountered. Client can contain authentication from the
	 * {@link AuthenticationStatus.nextStep}.
	 */
	soft?: Exception;
}

/** Authentication status returned by {@link AuthenticationEngine}. */
interface AuthenticationStatus<Account extends AccountModel> {
	/**
	 * Token which needs to be sent to client. <br/> For now, this property is set only by
	 * challenge-response nonce generator.
	 */
	token?: string;
	/** Next step in the authentication process. */
	nextStep?: AuthenticationStepName;
	/** Error encountered in the authentication process. */
	error?: AuthenticationStatusError;
	/** Property set only when authentication is completed successfully. Contains user account model. */
	authenticated?: Account;
}

/** @private */
interface AuthenticationStepOutput<Account extends AccountModel> {
	nextStep?: AuthenticationStepName;
	done?: AuthenticationStatus<Account>;
}

/** @private */
interface AuthenticationStep<Account extends AccountModel> {
	process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder,
		previousAuthenticationStepName: AuthenticationStepName
	): Promise<AuthenticationStepOutput<Account>>;
}

export type { AuthenticationStatus, AuthenticationStatusError, AuthenticationStepOutput, AuthenticationStep };
