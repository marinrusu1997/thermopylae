import { RegistrationOptions } from '@marin/lib.auth-engine';
import {
	AuthRequest,
	ChangeForgottenPasswordRequest,
	ChangePasswordRequest,
	CreateForgotPasswordSessionRequest,
	RegistrationRequest
} from '@marin/lib.auth-engine/dist/types/requests';
import { AuthStatus } from '@marin/lib.auth-engine/dist/authentication/auth-step';
import { ActiveUserSession } from '@marin/lib.auth-engine/dist/types/sessions';
import { AccessPointModel, FailedAuthAttemptsModel } from '@marin/lib.auth-engine/dist/types/models';
import { BasicCredentials } from '@marin/lib.auth-engine/dist/types/basic-types';
import Exception from '@marin/lib.error';
import { AuthServiceMethods } from '@marin/declarations/lib/services';
import { IIssuedJWTPayload } from '@marin/lib.jwt';

interface MethodBehaviour {
	expectingInput: (...args: any[]) => void;
	returns?: boolean | number | string | void | AuthStatus | Array<ActiveUserSession & AccessPointModel> | Array<FailedAuthAttemptsModel>;
	throws?: Error | Exception;
}

class AuthenticationEngineMock {
	private readonly methodsBehaviour: Map<AuthServiceMethods, MethodBehaviour> = new Map<AuthServiceMethods, MethodBehaviour>();

	setMethodBehaviour(method: AuthServiceMethods, behaviour: MethodBehaviour): void {
		this.methodsBehaviour.set(method, behaviour);
	}

	clearMethodBehaviours(): void {
		this.methodsBehaviour.clear();
	}

	async authenticate(authRequest: AuthRequest): Promise<AuthStatus> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.AUTHENTICATE);
		behaviour.expectingInput(authRequest);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as AuthStatus;
	}

	async register(registrationInfo: RegistrationRequest, options?: Partial<RegistrationOptions>): Promise<string> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.REGISTER);
		behaviour.expectingInput(registrationInfo, options);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as string;
	}

	async activateAccount(activateAccountToken: string): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.ACTIVATE_ACCOUNT);
		behaviour.expectingInput(activateAccountToken);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as void;
	}

	async enableMultiFactorAuthentication(...args: any[]): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS);
		behaviour.expectingInput(...args);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as void;
	}

	async disableMultiFactorAuthentication(...args: any[]): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS);
		behaviour.expectingInput(...args);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as void;
	}

	async getActiveSessions(accountId: string): Promise<Array<ActiveUserSession & AccessPointModel>> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.GET_ACTIVE_SESSIONS);
		behaviour.expectingInput(accountId);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as Array<ActiveUserSession & AccessPointModel>;
	}

	async getFailedAuthAttempts(accountId: string, startingFrom?: number, endingTo?: number): Promise<Array<FailedAuthAttemptsModel>> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS);
		behaviour.expectingInput(accountId, startingFrom, endingTo);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as Array<FailedAuthAttemptsModel>;
	}

	async areAccountCredentialsValid(accountId: string, credentials: BasicCredentials): Promise<boolean> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS);
		behaviour.expectingInput(accountId, credentials);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as boolean;
	}

	async disableAccount(accountId: string, cause: string): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CHANGE_ACCOUNT_STATUS);
		behaviour.expectingInput(accountId, cause);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as void;
	}

	async enableAccount(accountId: string): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CHANGE_ACCOUNT_STATUS);
		behaviour.expectingInput(accountId);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as void;
	}

	async changePassword(changePasswordRequest: ChangePasswordRequest): Promise<number | undefined> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD);
		behaviour.expectingInput(changePasswordRequest);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as undefined;
	}

	async createForgotPasswordSession(forgotPasswordRequest: CreateForgotPasswordSessionRequest): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION);
		behaviour.expectingInput(forgotPasswordRequest);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as undefined;
	}

	async changeForgottenPassword(changeForgottenPasswordRequest: ChangeForgottenPasswordRequest): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD);
		behaviour.expectingInput(changeForgottenPasswordRequest);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as undefined;
	}

	async logout(payload: IIssuedJWTPayload): Promise<void> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.LOGOUT);
		behaviour.expectingInput(payload);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as undefined;
	}

	async logoutFromAllDevices(payload: { sub: string; aud?: string }): Promise<number> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.LOGOUT_FROM_ALL_DEVICES);
		behaviour.expectingInput(payload);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as number;
	}

	async logoutFromAllDevicesExceptFromCurrent(accountId: string, sessionId: number): Promise<number> {
		const behaviour = this.getMethodBehaviour(AuthServiceMethods.LOGOUT_FROM_ALL_DEVICE_EXCEPT_FROM_CURRENT);
		behaviour.expectingInput(accountId, sessionId);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as number;
	}

	private getMethodBehaviour(method: AuthServiceMethods): MethodBehaviour {
		const behaviour = this.methodsBehaviour.get(method);
		if (!behaviour) {
			throw new Error(`MISCONFIGURATION. Method behaviour for ${method} not found.`);
		}
		return behaviour;
	}
}

export { AuthenticationEngineMock };
