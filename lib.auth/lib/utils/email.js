import { Email } from '@marin/lib.email/lib/email';
import { getAuthFromDifferentDeviceBodyHTML } from '../resources/email/authFromDiffDevice';
import { getMFAFailedHTML } from '../resources/email/mfaFailed';
import { getUnlockAccountHTML } from '../resources/email/unlockAccount';
import { getNotificationAccountLockedToAdminHTML } from '../resources/email/accountLockedToAdmin';
import { getActivateAccountHTML } from '../resources/email/activateAccount';

/**
 * Sends confirmation email to user when auth has been detected from
 * an access point which was not used previously (ip & device pair)
 *
 * @param {string}	email	User email where message should be sent
 * @param {number}	id		Account id, which needs to be sent in the confirmation
 * @param {string}	device	Device from where auth has been made
 * @param {string}	ip		IP from where auth has been made
 *
 * @throws {Exception}		When email delivery failed
 * @returns {Promise<void>}
 */
async function sendAuthFromDiffDeviceEmail(email, id, device, ip) {
	await Email.send({
		to: [email],
		subject: 'Authentication from different IP and Device detected',
		html: getAuthFromDifferentDeviceBodyHTML(id, device, ip)
	});
}

/**
 * Notify user about suspicious activity at MFA step when it failed.
 * Suggest him to change password.
 *
 * @param {string}	email	User email where message should be sent
 * @param {string}	device	Device from where auth has been made
 * @param {string}	ip		IP from where auth has been made
 *
 * @throws {Exception}		When email delivery failed
 * @returns {Promise<void>}
 */
async function sendNotificationMFAFailedEmail(email, device, ip) {
	await Email.send({
		to: [email],
		subject: 'MFA Failed Authentication Attempt',
		html: getMFAFailedHTML(device, ip)
	});
}

/**
 * Sends account unlock token to the account owner via his email
 *
 * @param {string}	email	User email where token should be sent
 * @param {string}	token	Unlock account token (plain one)
 *
 * @throws {Exception}		When email delivery failed
 * @returns {Promise<void>}
 */
async function sendUnlockAccountEmail(email, token) {
	await Email.send(
		{
			to: [email],
			subject: 'Unlock Account',
			html: getUnlockAccountHTML(token)
		},
		true
	);
}

/**
 * Sends a notification to admin about user account lock.
 * Also sends unlock token, so admin can unlock account if user forgot/not received his token.
 *
 * @param {string}	email		Admin email
 * @param {number}	accountId	Account id which was locked
 * @param {string}	token		Unlock token which was also sent to user
 *
 * @throws {Exception}		When email delivery failed
 * @returns {Promise<void>}
 */
async function sendNotificationAccountLockedToAdminEmail(email, accountId, token) {
	await Email.send(
		{
			to: [email],
			subject: 'Locked Account',
			html: getNotificationAccountLockedToAdminHTML(accountId, token)
		},
		true
	);
}

/**
 * Sends confirmation email to user, in order to activate newly created account
 *
 * @param {string}	email		User email
 * @param {string}	token		Activate account token
 * @param {number}	accountId	Account id
 *
 * @throws {Exception}		When email delivery failed
 * @returns {Promise<void>}
 */
async function sendActivateAccountEmail(email, token, accountId) {
	await Email.send(
		{
			to: [email],
			subject: 'Activate Account',
			html: getActivateAccountHTML(token, accountId)
		},
		true
	);
}

export {
	sendAuthFromDiffDeviceEmail,
	sendNotificationMFAFailedEmail,
	sendUnlockAccountEmail,
	sendNotificationAccountLockedToAdminEmail,
	sendActivateAccountEmail
};
