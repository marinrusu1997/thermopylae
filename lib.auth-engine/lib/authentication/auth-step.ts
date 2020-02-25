import Exception from '@marin/lib.error';
import { AccountModel } from '../types/models';
import { AUTH_STEP } from '../types/enums';
import { OnGoingAuthenticationSession } from '../types/sessions';
import { AuthRequest } from '../types/requests';

export interface AuthStatus {
	token?: string;
	nextStep?: string;
	error?: {
		hard?: Exception;
		soft?: Exception;
	};
}

export interface AuthStepOutput {
	nextStep?: AUTH_STEP;
	done?: AuthStatus;
}

export interface AuthStep {
	process(authRequest: AuthRequest, account: AccountModel, session: OnGoingAuthenticationSession, prevStepName: AUTH_STEP): Promise<AuthStepOutput>;
}
