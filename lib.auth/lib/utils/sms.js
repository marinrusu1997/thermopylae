import { SMS } from '@marin/lib.sms';

/**
 * Sends TOTP to users telephone number
 *
 * @param {string}	telephone	User telephone number
 * @param {string}	totp		TOTP needed for MFA completion
 *
 * @returns {Promise<string>}	SMS id
 */
async function sendTOTPviaSMS(telephone, totp) {
	return SMS.send(telephone, `Complete MFA with this code: ${totp}`);
}

// eslint-disable-next-line import/prefer-default-export
export { sendTOTPviaSMS };
