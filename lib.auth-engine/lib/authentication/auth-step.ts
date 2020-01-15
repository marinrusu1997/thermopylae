import Exception from '@marin/lib.error';
import { AccountModel } from '../types/models';
import { AUTH_STEP } from '../types/enums';
import { AuthSession } from '../types/sessions';
import { AuthRequest } from '../types/requests';

export interface AuthStatus {
	token?: string;
	nextStep?: string;
	error?: {
		hard?: Error | Exception;
		soft?: Error | Exception;
	};
}

export interface AuthStepOutput {
	nextStep?: AUTH_STEP;
	done?: AuthStatus;
}

export interface AuthStep {
	process(networkInput: AuthRequest, account: AccountModel, session: AuthSession, prevStepName: AUTH_STEP): Promise<AuthStepOutput>;
}
