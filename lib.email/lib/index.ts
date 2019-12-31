import { Email } from './email';

let defaultInstance: Email | undefined;

/**
 * Returns the default email instance
 */
function getDefaultInstance(): Email {
	if (!defaultInstance) {
		defaultInstance = new Email();
	}
	return defaultInstance;
}

export * from './email';
export { getDefaultInstance };
