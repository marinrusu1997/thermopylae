import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../../types/models';
import type { AuthenticationContext } from '../../types/contexts';

// @fixme implement 2fa with push notifications https://www.npmjs.com/package/node-pushnotifications
class PushNotificationsAuthStrategy implements TwoFactorAuthStrategy<AccountModel> {
	public async onTwoFactorAuthEnabled(): Promise<null> {
		throw new Error('NOT IMPLEMENTED!');
	}

	public async sendAuthenticationToken(
		_account: AccountModel,
		_authenticationContext: AuthenticationContext,
		_authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void> {
		throw new Error('NOT IMPLEMENTED!');
	}

	public async isAuthenticationTokenValid(
		_account: AccountModel,
		_authenticationContext: AuthenticationContext,
		_authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<boolean> {
		throw new Error('NOT IMPLEMENTED!');
	}
}

export { PushNotificationsAuthStrategy };
