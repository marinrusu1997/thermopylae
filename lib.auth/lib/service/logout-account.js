import { logger } from '../logger';

/**
 * @interface IAccountLogoutManagerOptions
 *
 * @property {Jwt}						jwt						Jwt instance
 * @property {Map<string, number>}		[jwtRolesExpiration]	Expiration per user roles
 * @property {IAuthSessionOperations}	authSessionModel
 * @property {IAccountOperations}		accountModel
 */

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     opts: IAccountLogoutManagerOptions
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

/** Helper class for Auth Service which is responsible for logout management */
class LogoutManager {
	/**
	 * @param {IAccountLogoutManagerOptions}	options
	 */
	constructor(options) {
		internal(this).opts = options;
	}

	/**
	 * @param {IIssuedJWTPayload} payload
	 * @returns {Promise<void>}
	 */
	async logout(payload) {
		const { jwt, jwtRolesExpiration, authSessionModel } = internal(this).opts;
		const ttl = jwtRolesExpiration ? jwtRolesExpiration.get(payload.aud) : undefined;
		logger.info(`Logout from one device for ${payload.sub}`);
		await jwt.blacklist().revoke(payload, ttl);
		logger.debug(`Deleting active session for ${payload.sub} with id ${payload.iat}`);
		await authSessionModel.deleteOne(payload.iat);
	}

	/**
	 * @param {number}	accountId
	 * @returns {Promise<void>}
	 */
	async logoutFromAllDevices(accountId) {
		const { jwt, jwtRolesExpiration, authSessionModel, accountModel } = internal(this).opts;
		logger.debug(`Logout from all devices: reading account info for ${accountId}`);
		const account = await accountModel.readById(accountId);
		const ttl = jwtRolesExpiration ? jwtRolesExpiration.get(account.role) : undefined;
		logger.info(`Logout from all devices: purging issued jwt tokens for ${accountId}`);
		await jwt.blacklist().purge(account.id, account.role, ttl);
		logger.info(`Logout from all devices: deleting active sessions for ${accountId}`);
		await authSessionModel.deleteAll(accountId);
	}
}

// eslint-disable-next-line import/prefer-default-export
export { LogoutManager };
