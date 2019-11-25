/**
 * Generates the HTML content which needs to be sent in the
 * `Notify about MFA failed auth attempt` email
 *
 * @param {string}	device	Device from where auth has been made
 * @param {string}	ip		IP from where auth has been made
 *
 * @return {string}		HTML content of the email
 */
function getMFAFailedHTML(device, ip) {
	/** FIXME implement this */
	throw new Error('NOT IMPLEMENTED');
}

// eslint-disable-next-line import/prefer-default-export
export { getMFAFailedHTML };
