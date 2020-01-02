import Exception from '@marin/lib.error';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';
import { AuthSession } from '../models/sessions';
import { AuthNetworkInput } from '../types';

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
	process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput>;
}
