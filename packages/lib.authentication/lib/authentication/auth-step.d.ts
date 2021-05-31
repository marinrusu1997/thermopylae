import { Exception } from '@thermopylae/lib.exception';
import { AccountModel } from '../types/models';
import { AUTH_STEP } from '../types/enums';
import { AuthenticationSession } from '../types/sessions';
import { AuthenticationContext } from '../types/requests';

declare interface AuthStatus {
	token?: string;
	nextStep?: string;
	error?: {
		hard?: Exception;
		soft?: Exception;
	};
}

declare interface AuthStepOutput {
	nextStep?: AUTH_STEP;
	done?: AuthStatus;
}

declare interface AuthStep {
	process(authRequest: AuthenticationContext, account: AccountModel, session: AuthenticationSession, prevStepName: AUTH_STEP): Promise<AuthStepOutput>;
}

export { AuthStatus, AuthStepOutput, AuthStep };
