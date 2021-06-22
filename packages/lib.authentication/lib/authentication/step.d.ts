import type { Exception } from '@thermopylae/lib.exception';
import type { AccountModel } from '../types/models';
import type { AuthenticationStepName } from '../types/enums';
import type { AuthenticationSessionRepositoryHolder } from '../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../types/contexts';

interface AuthenticationStatus<Account extends AccountModel> {
	token?: string;
	nextStep?: string;
	error?: {
		hard?: Exception;
		soft?: Exception;
	};
	authenticated?: Account;
}

interface AuthenticationStepOutput<Account extends AccountModel> {
	nextStep?: AuthenticationStepName;
	done?: AuthenticationStatus<Account>;
}

interface AuthenticationStep<Account extends AccountModel> {
	process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder,
		previousAuthenticationStepName: AuthenticationStepName
	): Promise<AuthenticationStepOutput<Account>>;
}

export { AuthenticationStatus, AuthenticationStepOutput, AuthenticationStep };
