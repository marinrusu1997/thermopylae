import {
	AccountModel,
	AccountToBeRegistered,
	AuthenticationContext,
	AuthenticationEngine,
	ChangePasswordContext,
	ErrorCodes as AuthenticationErrorCodes,
	SetTwoFactorAuthenticationContext
} from '@thermopylae/lib.authentication';
import { ErrorCodes, HttpRequest, HttpResponse, HttpStatusCode, Library, Mutable, ObjMap, Undefinable } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import farmhash from 'farmhash';
import { createException } from './error';
import { logger } from './logger';
import { BeforeAccountRegistration, OnSuccessfulAuthentication } from './hooks';

interface AuthenticationMiddlewareOptions<Account extends AccountModel> {
	authenticationEngine: AuthenticationEngine<Account>;
	hooks: {
		onSuccessfulAuthentication: OnSuccessfulAuthentication;
		beforeAccountRegistration: BeforeAccountRegistration<Account>;
	};
	queryParams: {
		activateAccountToken: string;
		enableTwoFactorAuthentication: string;
		disableAccountUntil: string;
		getFailedAuthentications: {
			from: string;
			to: string;
		};
		getSuccessfulAuthentications: {
			from: string;
			to: string;
		};
	};
	forgotPasswordSessionSideChannel: 'email' | 'sms';
}

class AuthenticationMiddleware<Account extends AccountModel> {
	private readonly options: AuthenticationMiddlewareOptions<Account>;

	public constructor(options: AuthenticationMiddlewareOptions<Account>) {
		this.options = options;
	}

	public async authenticate(req: HttpRequest, res: HttpResponse): Promise<void> {
		const authContext = req.body as Mutable<AuthenticationContext>;
		authContext.ip = req.ip;
		authContext.location = req.location;
		authContext.device = req.device;
		authContext.deviceId = AuthenticationMiddleware.computeDeviceId(req);

		try {
			const authenticationStatus = await this.options.authenticationEngine.authenticate(authContext);

			if (authenticationStatus.authenticated) {
				await this.options.hooks.onSuccessfulAuthentication(authContext, req, res);
				res.status(HttpStatusCode.Ok).send();
				return;
			}

			if (authenticationStatus.nextStep) {
				if (authenticationStatus.error && authenticationStatus.error.soft) {
					logger.error(`Authentication failed. Context: ${JSON.stringify(authContext)}.`, authenticationStatus.error.soft);
					res.status(HttpStatusCode.Unauthorized).send({ nextStep: authenticationStatus.nextStep });
					return;
				}

				res.status(HttpStatusCode.Accepted).send({ nextStep: authenticationStatus.nextStep, token: authenticationStatus.token });
				return;
			}

			if (authenticationStatus.error && authenticationStatus.error.hard) {
				logger.error(`Authentication failed. Context: ${JSON.stringify(authContext)}.`, authenticationStatus.error.hard);
				res.status(HttpStatusCode.Gone).send();
				return;
			}

			throw createException(
				ErrorCodes.MISCONFIGURATION,
				`Authentication completed, but it's status couldn't be resolved. Authentication status: ${JSON.stringify(authenticationStatus)}.`
			);
		} catch (e) {
			logger.error(`Authentication failed. Context: ${JSON.stringify(authContext)}.`, e);
			res.status(HttpStatusCode.BadRequest).send();
		}
	}

	public async register(req: HttpRequest, res: HttpResponse): Promise<void> {
		await this.options.hooks.beforeAccountRegistration(req.body as AccountToBeRegistered<Account>);
		await this.options.authenticationEngine.register(req.body as AccountToBeRegistered<Account>);
		res.status(HttpStatusCode.Created).send();
	}

	public async activateAccount(req: HttpRequest, res: HttpResponse): Promise<void> {
		try {
			await this.options.authenticationEngine.activateAccount(req.query(this.options.queryParams.activateAccountToken) as string);
			res.status(HttpStatusCode.NoContent).send();
		} catch (e) {
			if (e instanceof Exception && e.emitter === Library.AUTHENTICATION && e.code === AuthenticationErrorCodes.SESSION_NOT_FOUND) {
				logger.error(`Account activation failed. Request origin: ${req.ip}.`, e);
				res.status(HttpStatusCode.BadRequest).send({ code: 'INVALID_TOKEN' });
				return;
			}
			throw e;
		}
	}

	public async setTwoFactorAuthEnabled(req: HttpRequest, res: HttpResponse, accountId: string): Promise<void> {
		const context = req.body as Mutable<SetTwoFactorAuthenticationContext>;
		context.ip = req.ip;
		context.location = req.location;
		context.device = req.device;

		try {
			await this.options.authenticationEngine.setTwoFactorAuthEnabled(
				accountId,
				Number(req.query(this.options.queryParams.enableTwoFactorAuthentication)) === 1,
				context
			);

			res.status(HttpStatusCode.NoContent).send();
		} catch (e) {
			if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
				logger.error(`Set two factor authentication enabled failed. Context: ${JSON.stringify(context)}.`, e);

				let httpResponseStatus: number;
				switch (e.code) {
					case AuthenticationErrorCodes.ACCOUNT_NOT_FOUND:
						httpResponseStatus = HttpStatusCode.NotFound;
						break;
					case AuthenticationErrorCodes.ACCOUNT_DISABLED:
						httpResponseStatus = HttpStatusCode.Gone;
						break;
					case AuthenticationErrorCodes.INCORRECT_PASSWORD:
						httpResponseStatus = HttpStatusCode.Unauthorized;
						break;
					default:
						throw createException(
							ErrorCodes.MISCONFIGURATION,
							`Could not determine http response code from Exception thrown by AuthenticationEngine.changePassword method. Error code: ${e.code}.`
						);
				}

				res.status(httpResponseStatus).send({ code: e.code });
				return;
			}

			throw e;
		}
	}

	public async getFailedAuthentications(req: HttpRequest, res: HttpResponse, accountId: string): Promise<void> {
		let from: string | number | null | undefined = req.query(this.options.queryParams.getFailedAuthentications.from);
		if (from != null) {
			from = Number(from);
		}

		let to: string | number | null | undefined = req.query(this.options.queryParams.getFailedAuthentications.to);
		if (to != null) {
			to = Number(to);
		}

		const failedAuthentications = this.options.authenticationEngine.getFailedAuthentications(accountId, from, to);

		res.status(HttpStatusCode.Ok).send(failedAuthentications);
	}

	public async getSuccessfulAuthentications(req: HttpRequest, res: HttpResponse, accountId: string): Promise<void> {
		let from: string | number | null | undefined = req.query(this.options.queryParams.getSuccessfulAuthentications.from);
		if (from != null) {
			from = Number(from);
		}

		let to: string | number | null | undefined = req.query(this.options.queryParams.getSuccessfulAuthentications.to);
		if (to != null) {
			to = Number(to);
		}

		const successfulAuthentications = this.options.authenticationEngine.getSuccessfulAuthentications(accountId, from, to);

		res.status(HttpStatusCode.Ok).send(successfulAuthentications);
	}

	public async changePassword(req: HttpRequest, res: HttpResponse, accountId: string): Promise<void> {
		const context = req.body as Mutable<ChangePasswordContext>;
		context.ip = req.ip;
		context.location = req.location;
		context.device = req.device;
		context.accountId = accountId;

		try {
			await this.options.authenticationEngine.changePassword(context);
			res.status(HttpStatusCode.Ok).send();
		} catch (e) {
			if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
				logger.error(`Change password failed. Context: ${JSON.stringify(context)}.`, e);

				let httpResponseStatus: number;
				switch (e.code) {
					case AuthenticationErrorCodes.ACCOUNT_NOT_FOUND:
						httpResponseStatus = HttpStatusCode.NotFound;
						break;
					case AuthenticationErrorCodes.ACCOUNT_DISABLED:
						httpResponseStatus = HttpStatusCode.Gone;
						break;
					case AuthenticationErrorCodes.INCORRECT_PASSWORD:
						httpResponseStatus = HttpStatusCode.Unauthorized;
						break;
					case AuthenticationErrorCodes.SIMILAR_PASSWORDS:
					case AuthenticationErrorCodes.WEAK_PASSWORD:
						httpResponseStatus = HttpStatusCode.BadRequest;
						break;
					default:
						throw createException(
							ErrorCodes.MISCONFIGURATION,
							`Could not determine http response code from Exception thrown by AuthenticationEngine.changePassword method. Error code: ${e.code}.`
						);
				}

				res.status(httpResponseStatus).send({ code: e.code });
				return;
			}

			throw e;
		}
	}

	public async createForgotPasswordSession(req: HttpRequest, res: HttpResponse): Promise<void> {
		let readByField: 'readByUsername' | 'readByEmail' | 'readByTelephone';
		let readByValue: string;

		if ((req.body as ObjMap)['username'] != null) {
			readByField = 'readByUsername';
			readByValue = (req.body as ObjMap)['username'];
		} else if ((req.body as ObjMap)['email'] != null) {
			readByField = 'readByEmail';
			readByValue = (req.body as ObjMap)['email'];
		} else if ((req.body as ObjMap)['telephone'] != null) {
			readByField = 'readByTelephone';
			readByValue = (req.body as ObjMap)['telephone'];
		} else {
			throw createException(ErrorCodes.NOT_FOUND, `Could not find account unique field in the request body: ${JSON.stringify(req.body)}.`);
		}

		try {
			await this.options.authenticationEngine.createForgotPasswordSession(readByField as any, readByValue, this.options.forgotPasswordSessionSideChannel);

			res.status(HttpStatusCode.Accepted).send();
		} catch (e) {
			if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
				if (e.code === AuthenticationErrorCodes.ACCOUNT_NOT_FOUND) {
					logger.error(`Create forgot password session failed. Request body: ${JSON.stringify(req.body)}.`, e);
					res.status(HttpStatusCode.NotFound).send({ code: e.code });
					return;
				}

				if (e.code === AuthenticationErrorCodes.ACCOUNT_DISABLED) {
					logger.error(`Create forgot password session failed. Request body: ${JSON.stringify(req.body)}.`, e);
					res.status(HttpStatusCode.Gone).send({ code: e.code });
					return;
				}
			}

			throw e;
		}
	}

	public async changeForgottenPassword(req: HttpRequest, res: HttpResponse): Promise<void> {
		try {
			await this.options.authenticationEngine.changeForgottenPassword((req.body as ObjMap)['token'], (req.body as ObjMap)['newPassword']);
			res.status(HttpStatusCode.NoContent).send();
		} catch (e) {
			if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
				logger.error(`Change forgotten password failed. Request origin: ${req.ip}.`, e);

				let { code } = e;
				let httpResponseStatus: number;
				switch (e.code) {
					case AuthenticationErrorCodes.ACCOUNT_NOT_FOUND:
						httpResponseStatus = HttpStatusCode.NotFound;
						break;
					case AuthenticationErrorCodes.ACCOUNT_DISABLED:
						httpResponseStatus = HttpStatusCode.Gone;
						break;
					case AuthenticationErrorCodes.SESSION_NOT_FOUND:
						code = 'INVALID_TOKEN';
						httpResponseStatus = HttpStatusCode.NotFound;
						break;
					case AuthenticationErrorCodes.WEAK_PASSWORD:
						httpResponseStatus = HttpStatusCode.BadRequest;
						break;
					default:
						throw createException(
							ErrorCodes.MISCONFIGURATION,
							`Could not determine http response code from Exception thrown by AuthenticationEngine.changeForgottenPassword method. Error code: ${e.code}.`
						);
				}

				res.status(httpResponseStatus).send({ code });
				return;
			}

			throw e;
		}
	}

	public async enableAccount(res: HttpResponse, accountId: string): Promise<void> {
		await this.options.authenticationEngine.enableAccount(accountId);
		res.status(HttpStatusCode.NoContent).send();
	}

	public async disableAccount(req: HttpRequest, res: HttpResponse, accountId: string): Promise<void> {
		try {
			await this.options.authenticationEngine.disableAccount(
				accountId,
				Number(req.query(this.options.queryParams.disableAccountUntil)),
				(req.body && (req.body as ObjMap)['cause']) || ''
			);
			res.status(HttpStatusCode.NoContent).send();
		} catch (e) {
			if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
				if (e.code === AuthenticationErrorCodes.ACCOUNT_NOT_FOUND) {
					logger.error(`Disable account with id: ${accountId} failed.`, e);
					res.status(HttpStatusCode.NotFound).send({ code: e.code });
					return;
				}

				if (e.code === AuthenticationErrorCodes.ACCOUNT_DISABLED) {
					logger.error(`Disable account with id: ${accountId} failed.`, e);
					res.status(HttpStatusCode.Gone).send({ code: e.code });
					return;
				}
			}

			throw e;
		}
	}

	private static computeDeviceId(req: HttpRequest): string {
		const userAgent = req.header('user-agent') as Undefinable<string>;
		if (userAgent == null) {
			throw createException(ErrorCodes.REQUIRED, "'User-Agent' header is required.");
		}
		return farmhash.hash64(userAgent);
	}
}

export { AuthenticationMiddleware };
