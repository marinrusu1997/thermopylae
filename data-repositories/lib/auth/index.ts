import { AccountEntity } from './account';

class AuthRepository {
	private static readonly _accountEntity = new AccountEntity();

	public static get accountEntity(): AccountEntity {
		// eslint-disable-next-line no-underscore-dangle
		return AuthRepository._accountEntity;
	}
}

export { AuthRepository };
