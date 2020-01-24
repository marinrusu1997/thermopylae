import { EmailClient } from './email-client';
import { ErrorCodes } from './error';

let defaultInstance: EmailClient | undefined;

/**
 * Returns the default email instance
 */
function getDefaultEmailClientInstance(): EmailClient {
	if (!defaultInstance) {
		defaultInstance = new EmailClient();
	}
	return defaultInstance;
}

export * from './email-client';
export { getDefaultEmailClientInstance, ErrorCodes };
