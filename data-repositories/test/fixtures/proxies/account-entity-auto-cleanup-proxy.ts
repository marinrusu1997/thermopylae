import { models } from '@marin/lib.authentication-engine';
import { ResourcesManagerInstance } from '../resources-manager';
import { ResourceType } from '../commons';
import { AccountEntity } from '../../../lib/auth/account';

class AccountEntityAutoCleanupProxy extends AccountEntity {
	create(account: models.AccountModel): Promise<string> {
		ResourcesManagerInstance.markForDeletionInNextCleanup(ResourceType.ACCOUNT);
		return super.create(account);
	}
}

const AccountEntityAutoCleanupProxyInstance = new AccountEntityAutoCleanupProxy();

export { AccountEntityAutoCleanupProxyInstance };
