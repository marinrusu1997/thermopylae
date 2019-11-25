import { AUTH_TOKEN_TYPE, generateToken } from '@marin/lib.utils';
import { logger } from '../logger';

/**
 * Converts year and month to UNIX timestamp in milliseconds precision
 *
 * @param {number}	currentYear		Year
 * @param {number}	currentMonth	Month index (from 0 to 11)
 *
 * @return {number}		Timestamp
 */
function nextMonthToTimestamp(currentYear, currentMonth) {
	if (currentMonth === 11) {
		return new Date(currentYear + 1, 0); // 01 january for next year
	}
	return new Date(currentYear, currentMonth + 1); // 01 next month same year
}

/**
 * Fills the missing properties with default values
 *
 * @param {IOptions}  opts  AuthService config options
 *
 * @return {IOptions}
 */
function optionsOrDefaults(opts) {
	/* TTL defaults */
	// eslint-disable-next-line no-param-reassign
	opts.ttl = opts.ttl || {};
	// eslint-disable-next-line no-param-reassign
	opts.ttl.failedAuthAttemptSession = opts.ttl.failedAuthAttemptSession || 60; // minutes
	// eslint-disable-next-line no-param-reassign
	opts.ttl.bannedIP = opts.ttl.bannedIP || 60; // minutes
	// eslint-disable-next-line no-param-reassign
	opts.ttl.resetPasswordToken = opts.ttl.resetPasswordToken || 15; // minutes
	// eslint-disable-next-line no-param-reassign
	opts.ttl.totp = opts.ttl.totp || 30; // seconds
	// eslint-disable-next-line no-param-reassign
	opts.ttl.unlockAccount = opts.ttl.unlockAccount || 60; // minutes
	// eslint-disable-next-line no-param-reassign
	opts.ttl.identityToken = opts.ttl.identityToken || 2; // minutes
	// eslint-disable-next-line no-param-reassign
	opts.ttl.activateAccountSession = opts.ttl.activateAccountSession || 60; // minutes
	// eslint-disable-next-line no-param-reassign
	opts.ttl.forgotPasswordSession = opts.ttl.forgotPasswordSession || 30; // minutes
	/** FIXME add other ttls */

	/* Thresholds defaults */
	// eslint-disable-next-line no-param-reassign
	opts.thresholds = opts.thresholds || {};
	/* FIXME add defaults there when implementing methods */
	// eslint-disable-next-line no-param-reassign
	opts.thresholds.forgotPasswordGuesses = opts.thresholds.forgotPasswordGuesses || 10;
	// eslint-disable-next-line no-param-reassign
	opts.thresholds.captcha = opts.thresholds.captcha || 5;
	// eslint-disable-next-line no-param-reassign
	opts.thresholds.failedAuthAttempts = opts.thresholds.failedAuthAttempts || 10;

	/* Size defaults */
	// eslint-disable-next-line no-param-reassign
	opts.size = opts.size || {};
	// eslint-disable-next-line no-param-reassign
	opts.size.salt = opts.size.salt || 32; // bytes
	// eslint-disable-next-line no-param-reassign
	opts.size.token = opts.size.token || 48; // bytes

	/* Other defaults */
	/* FIXME add defaults there when implementing methods */

	return opts;
}

/**
 * Handles invalid PIN/Password
 *
 * @param {IAuthInput}  data
 * @param {IAccount}    account
 * @param {IOptions}    opts
 *
 * @throws {Exception}
 * @returns {Promise<void>}
 */
async function handleInvalidCredentials(data, account, opts) {
	const failedAuthAttempts = await opts.models.failedAuthAttemptSession.read(data.username);
	if (!failedAuthAttempts) {
		logger.warning(`Invalid credentials provided for ${data.username}. Creating failed auth attempts record`);
		await opts.models.failedAuthAttemptSession.create(
			{
				username: data.username,
				timestamp: new Date().getTime(),
				ip: data.IP,
				device: data.device,
				location: data.location,
				counter: 1
			},
			opts.ttl.failedAuthAttemptSession
		);
	} else if (failedAuthAttempts.counter === opts.thresholds.captcha) {
		logger.crit(`Enabling captcha for ${data.username}`);
		await opts.models.recaptcha.create(data.username, opts.ttl.recaptcha);
	} else if (failedAuthAttempts.counter === opts.thresholds.failedAuthAttempts) {
		logger.alert(`Too many failed auth attempts for ${data.username}. Invoke deny auth procedure`);
		await this.lockAccount(account.id, account.email, opts.email.admin);
		const ipToBan = failedAuthAttempts.ip.split(',');
		logger.debug('Banning IPs.', ipToBan);
		await opts.models.bannedIP.create(data.username, ipToBan, opts.ttl.bannedIP);
		logger.debug(`Deleting failed auth attempts for ${data.username}`);
		await opts.models.failedAuthAttemptSession.delete(data.username);
		logger.info('Creating persistent record with failed auth attempts');
		await opts.models.failedAuthAttempt.create(failedAuthAttempts);
	} else {
		logger.warning(`Invalid credentials provided ${data.username}. Updating failed auth attempts`);
		await opts.models.failedAuthAttemptSession.update({
			username: data.username,
			timestamp: new Date().getTime(),
			ip: `${failedAuthAttempts.ip},${data.IP}`,
			device: `${failedAuthAttempts.ip},${data.device}`,
			location: `${failedAuthAttempts.location},${data.location}`,
			counter: failedAuthAttempts.counter + 1
		});
	}
}

export { nextMonthToTimestamp, optionsOrDefaults, handleInvalidCredentials };
