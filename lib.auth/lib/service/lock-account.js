import { ErrorCodes, generateToken } from '@marin/lib.utils';
import { logger } from '../logger';
import { sendNotificationAccountLockedToAdminEmail, sendUnlockAccountEmail } from '../utils/email';
import { createException } from '../error';

/**
 * @interface IAccountLockerOptions
 *
 * @property {number}							unlockTokenSize
 * @property {number}							unlockTokenTTL
 * @property {IAccountOperations}				accountModel
 * @property {IUnlockAccountSessionOperations}	unlockAccountSessionModel
 * @property {AccountLogoutManager}				accountLogoutManager
 */

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     opts: IAccountLockerOptions
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

/** Helper class for Auth Service which manages account locks */
class AccountLocker {
	/**
	 * @param {IAccountLockerOptions} options
	 */
	constructor(options) {
		internal(this).opts = options;
	}

	/**
	 * @param {number} accountId
	 * @param {string} userEmail
	 * @param {string} adminEmail
	 *
	 * @returns {Promise<void>}
	 */
	async lock(accountId, userEmail, adminEmail) {
		const {
			accountLogoutManager,
			unlockTokenSize,
			unlockTokenTTL,
			accountModel,
			unlockAccountSessionModel
		} = internal(this).opts;
		logger.info(`Starting account lock procedure for account ${accountId}`);
		try {
			await accountLogoutManager.logoutFromAllDevices(accountId);
		} catch (error) {
			logger.warning('Failed to invalidate existing sessions', error);
		}
		logger.debug(`Generating unlock account tokens for account ${accountId}`);
		const token = await generateToken(unlockTokenSize);
		logger.info(`Locking account ${accountId}`);
		await accountModel.setLocked(accountId, true);
		try {
			logger.debug(`Storing unlock account token for ${accountId}`);
			await unlockAccountSessionModel.create(token.plain, accountId, unlockTokenTTL);
		} catch (error) {
			logger.emerg(
				`Failed to store unlock account token for ${accountId}. DBA should manually change unlock flag`
			);
			return;
		}
		try {
			logger.debug('Sending unlock account emails');
			await sendUnlockAccountEmail(userEmail, token.plain);
			await sendNotificationAccountLockedToAdminEmail(adminEmail, accountId, token.plain);
		} catch (error) {
			logger.emerg(
				`Failed to send unlock account tokens for ${accountId}. DBA should manually change unlock flag and delete unlock account entry`
			);
		}
	}

	/**
	 * @param {string} token
	 * @returns {Promise<void>}
	 */
	async unlock(token) {
		const { accountModel, unlockAccountSessionModel } = internal(this).opts;
		const accountId = await unlockAccountSessionModel.read(token);
		if (!accountId) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, 'No unlock account token was found');
		}
		logger.info(`Provided unlock account token for account ${accountId} is correct. Unlocking account`);
		await accountModel.setLocked(accountId, false);
		logger.debug(`Deleting unlock account token for account ${accountId}`);
		await unlockAccountSessionModel.delete(token);
	}
}

// eslint-disable-next-line import/prefer-default-export
export { AccountLocker };
