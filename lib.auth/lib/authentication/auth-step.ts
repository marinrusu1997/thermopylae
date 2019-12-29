import { Account } from '../models';
import { AUTH_STEP } from '../enums';
import { AuthSession } from '../models/sessions';
import { AuthNetworkInput } from '../types';

export interface AccessTokens {
	token: string;
}

export interface AuthStepOutput {
	nextStep?: AUTH_STEP;
	done?: string | AccessTokens;
}

export interface AuthStep {
	process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput>;
}
