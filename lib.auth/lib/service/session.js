import { ACTIONS, AUTH_TOKEN_TYPE, generateToken, LOG_CTX_COMPONENTS, OP_STATUS, RESOURCES } from '@marin/lib.utils';
import { LogContext } from '@marin/lib.logger';
import { logger } from '../logger';

/**
 * @typedef {{
 *     ip: string,
 *     device: string,
 *     location: string
 * }} AuthAccessPoint
 */

/**
 * Creates session after successful authentication
 *
 * @param {AuthAccessPoint}		authAccessPoint
 * @param {IAccount}			account
 * @param {Jwt}					jwt
 * @param {IOptionsJwt}			jwtOpts
 * @param {number}				csrfTokenSize
 * @param {ISessionEntity} 		sessionEntity
 * @param {IOptionsSchedulers}	schedulers
 * @param {boolean}				[authenticatedUsingMFA]
 *
 * @returns {Promise<IAccessTokens>}
 */
async function create(
	authAccessPoint,
	account,
	jwt,
	jwtOpts,
	csrfTokenSize,
	sessionEntity,
	schedulers,
	authenticatedUsingMFA
) {
	const iat = new Date().getTime();
	const /** @type {string} */ auth = jwt.sign(
			{
				sub: account.id,
				aud: account.role,
				iss: jwtOpts.issuer,
				iat,
				type: AUTH_TOKEN_TYPE.BASIC
			},
			jwtOpts.rolesExpiration ? { expiresIn: jwtOpts.rolesExpiration.get(account.role) } : undefined
		);
	const csrf = await generateToken(csrfTokenSize, true);
	await sessionEntity.create({
		timestamp: iat,
		accountId: account.id,
		ip: authAccessPoint.ip,
		device: authAccessPoint.device,
		location: authAccessPoint.location,
		csrf: csrf.hash,
		authenticatedUsingMFA
	});
	try {
		const expiresIn = jwtOpts.rolesExpiration ? jwtOpts.rolesExpiration.get(account.role) : jwtOpts.expiration;
		await schedulers.session.delete(iat, iat + expiresIn);
	} catch (error) {
		logger.error(
			LogContext.from({
				[LOG_CTX_COMPONENTS.ACTION]: ACTIONS.SCHEDULE,
				[LOG_CTX_COMPONENTS.SUBACTION]: ACTIONS.DELETE,
				[LOG_CTX_COMPONENTS.RESOURCE]: RESOURCES.SESSION,
				[LOG_CTX_COMPONENTS.VARIABLES]: { accountId: account.id, iat },
				[LOG_CTX_COMPONENTS.STATUS]: OP_STATUS.FAILED
			}).toString(),
			error
		);
	}
	return { auth, csrf: csrf.plain };
}

// eslint-disable-next-line import/prefer-default-export
export { create as createSession };
