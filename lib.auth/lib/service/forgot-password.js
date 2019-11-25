import { ACTIONS, generateToken, LOG_CTX_COMPONENTS, MethodInvoker, OP_STATUS, RESOURCES } from '@marin/lib.utils';
import { LogContext } from '@marin/lib.logger';
import { createException, ErrorCodes, ErrorMessages } from '../error';
import { logger } from '../logger';
import { FORGOT_PASSWORD_STEP } from '../enums';

/**
 * @typedef {{
 *     sessionTTL: number,
 *     sessionIdSize: number,
 *     guessThreshold: number,
 *     adminEmail: string,
 *     accountModel: IAccountOperations,
 *     personModel: IPersonOperations,
 *     forgotPasswordSessionModel: IForgotPasswordSessionOperations,
 *     accountLocker: AccountLocker,
 *     securityQuestions: SecurityQuestions
 *     passwordsManager: PasswordsManager
 *     logoutManager: LogoutManager
 * }} IForgotPasswordOptions
 */

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     opts: IForgotPasswordOptions
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

/**
 * @param {number} 								guessThreshold
 * @param {string}								adminEmail
 * @param {string} 								sessionId
 * @param {IForgotPasswordSession} 				session
 * @param {AccountLocker}						accountLocker
 * @param {IForgotPasswordSessionOperations}	forgotPasswordSessionModel
 *
 * @returns {Promise<void>}
 */
async function updateCounterOrLockAccountAndDeleteSession(
	guessThreshold,
	adminEmail,
	sessionId,
	session,
	accountLocker,
	forgotPasswordSessionModel
) {
	// eslint-disable-next-line no-param-reassign
	session.guessCounter += 1;
	if (session.guessCounter === guessThreshold) {
		await accountLocker.lock(session.accountId, session.email, adminEmail);
		await forgotPasswordSessionModel.delete(sessionId);
	} else {
		await forgotPasswordSessionModel.update(sessionId, { guessCounter: session.guessCounter });
	}
}

/** Helper class for Auth Service which incapsulates forgot password sequence */
class ForgotPasswordManager {
	/**
	 * @param {IForgotPasswordOptions} options
	 */
	constructor(options) {
		internal(this).opts = options;
	}

	/**
	 * Creates a new forgot password session
	 *
	 * @param {IForgotPasswordInitInput}	data	Data needed in order to create session
	 *
	 * @return {Promise<IForgotPasswordInitOutput>}
	 */
	async createSession(data) {
		const { sessionIdSize, sessionTTL, accountModel, forgotPasswordSessionModel } = internal(this).opts;
		const account = await accountModel.read(data.username);
		if (!account) {
			throw createException(ErrorCodes.INCORRECT_ACCOUNT, 'Account does not exist');
		}
		if (account.locked) {
			throw createException(ErrorCodes.LOCKED_ACCOUNT, ErrorMessages.LOCKED_ACCOUNT);
		}
		const sessionId = (await generateToken(sessionIdSize)).plain;
		logger.info(`Creating forgot password session for ${data.username}`);
		await forgotPasswordSessionModel.create(
			{
				id: sessionId,
				accountId: account.id,
				email: account.email,
				ip: data.IP,
				identity: false,
				answers: false,
				guessCounter: 0,
				resetToken: null /** FIXME maybe reset password can be delegated to reset password */
			},
			sessionTTL
		);
		return { sessionId };
	}

	/**
	 * Checks the identity of the who claimed that he forgot password to his account.
	 *
	 * @param {string}								sessionId	Id of the previously created session
	 * @param {IForgotPasswordVerifyIdentityInput}	data		Identity data
	 *
	 * @return {Promise<IForgotPasswordVerifyIdentityOutput>}		Data for next step involved
	 */
	async verifyIdentity(sessionId, data) {
		const {
			guessThreshold,
			adminEmail,
			accountLocker,
			securityQuestions,
			forgotPasswordSessionModel,
			personModel
		} = internal(this).opts;
		const session = await forgotPasswordSessionModel.readById(sessionId);
		if (!session) {
			throw createException(ErrorCodes.NO_SESSION, ErrorMessages.NO_SESSION);
		}
		const person = await personModel.read(session.accountId);
		if (
			data.identity.firstName.toLowerCase() !== person.firstName.toLowerCase() ||
			data.identity.lastName.toLowerCase() !== person.lastName.toLowerCase() ||
			data.identity.birthday !== person.birthday ||
			data.identity.lastFourOfSSN !== person.ssn.slice(person.ssn.length, -4) ||
			data.identity.zipCode !== person.zipCode ||
			data.identity.streetNo !== person.address.streetNo
		) {
			await updateCounterOrLockAccountAndDeleteSession(
				guessThreshold,
				adminEmail,
				sessionId,
				session,
				accountLocker,
				forgotPasswordSessionModel
			);
			throw createException(ErrorCodes.INCORRECT_IDENTITY, ErrorMessages.INCORRECT_IDENTITY);
		}
		const questions = await securityQuestions.getAll(session.accountId, data.language);
		await forgotPasswordSessionModel.update(sessionId, {
			identityStep: true,
			questions: Array.from(questions.values())
		});
		return { questions };
	}

	/**
	 * Checks the answers to security questions which are belonging to forgot password account
	 *
	 * @param {string}										sessionId		Id of the previously created session
	 * @param {IForgotPasswordVerifySecurityQuestionsInput}	data			Answers to questions
	 *
	 * @return {Promise<void>}
	 */
	async verifyAnswersToSecurityQuestions(sessionId, data) {
		const { opts } = internal(this);
		const { guessThreshold, adminEmail, accountLocker, securityQuestions, forgotPasswordSessionModel } = opts;
		const session = await forgotPasswordSessionModel.readById(sessionId);
		if (!session) {
			throw createException(ErrorCodes.NO_SESSION, ErrorMessages.NO_SESSION);
		}
		if (!session.identityStep) {
			throw createException(
				ErrorCodes.INVALID_STEP,
				`${ErrorMessages.INVALID_STEP}. ${FORGOT_PASSWORD_STEP.VERIFY_IDENTITY} step needs to be passed first`
			);
		}
		for (let i = 0; i < session.questions; i += 1) {
			if (!data.answers.has(session.questions[i])) {
				throw createException(ErrorCodes.INVALID_ARGUMENT, 'Some of the answers are missing');
			}
		}
		if (!(await securityQuestions.checkAnswerBulk(session.accountId, data.answers, true))) {
			await updateCounterOrLockAccountAndDeleteSession(
				guessThreshold,
				adminEmail,
				sessionId,
				session,
				accountLocker,
				forgotPasswordSessionModel
			);
			throw createException(ErrorCodes.INCORRECT_ANSWERS, ErrorMessages.INCORRECT_ANSWERS);
		}
		await forgotPasswordSessionModel.update(sessionId, { answersStep: true });
	}

	/**
	 * Changes the old password after all passed checks
	 *
	 * @param {string}										sessionId		Id of the previously created session
	 * @param {IForgotPasswordChangePasswordInput}			data			New password
	 *
	 * @return {Promise<void>}
	 */
	async changePassword(sessionId, data) {
		const { passwordsManager, logoutManager, forgotPasswordSessionModel } = internal(this).opts;
		const session = await forgotPasswordSessionModel.readById(sessionId);
		if (!session) {
			throw createException(ErrorCodes.NO_SESSION, ErrorMessages.NO_SESSION);
		}
		if (!session.identityStep) {
			throw createException(
				ErrorCodes.INVALID_STEP,
				`${ErrorMessages.INVALID_STEP}. ${FORGOT_PASSWORD_STEP.VERIFY_IDENTITY} step needs to be passed first`
			);
		}
		if (!session.answersStep) {
			throw createException(
				ErrorCodes.INVALID_STEP,
				`${ErrorMessages.INVALID_STEP}. ${FORGOT_PASSWORD_STEP.VERIFY_SECURITY_QUESTIONS} step needs to be passed first`
			);
		}
		await passwordsManager.change(session.accountId, data.password);
		await new MethodInvoker(logoutManager.logoutFromAllDevices, session.accountId)
			.logger(logger)
			.onErrMsg(
				LogContext.from({
					[LOG_CTX_COMPONENTS.ACTION]: ACTIONS.DELETE_BULK,
					[LOG_CTX_COMPONENTS.RESOURCE]: RESOURCES.AUTH_SESSION,
					[LOG_CTX_COMPONENTS.VARIABLES]: { accountId: session.accountId },
					[LOG_CTX_COMPONENTS.STATUS]: OP_STATUS.FAILED
				}).toString()
			)
			.safeInvokeAsync();
		await new MethodInvoker(forgotPasswordSessionModel.delete, sessionId)
			.logger(logger)
			.onErrMsg(
				LogContext.from({
					[LOG_CTX_COMPONENTS.ACTION]: ACTIONS.DELETE,
					[LOG_CTX_COMPONENTS.RESOURCE]: RESOURCES.FORGOT_PASSWORD_SESSION,
					[LOG_CTX_COMPONENTS.VARIABLES]: { accountId: session.accountId, sessionId },
					[LOG_CTX_COMPONENTS.STATUS]: OP_STATUS.FAILED
				}).toString()
			)
			.safeInvokeAsync();
	}
}

// eslint-disable-next-line import/prefer-default-export
export { ForgotPasswordManager };
