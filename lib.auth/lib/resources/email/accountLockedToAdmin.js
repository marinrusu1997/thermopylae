/**
 * Generates the HTML content which needs to be sent in the
 * `Notification to DBA about locked account` email
 *
 * @param {number}	accountId 	Account id which was locked
 * @param {string}	token		Unlock token which was also sent to user
 *
 * @return {string}		HTML content of the email
 */
function getNotificationAccountLockedToAdminHTML(accountId, token) {
	/** FIXME implement this */
	throw new Error('NOT IMPLEMENTED');
}

// eslint-disable-next-line import/prefer-default-export
export { getNotificationAccountLockedToAdminHTML };
