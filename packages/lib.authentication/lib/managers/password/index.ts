import type { AccountRepository } from '../../types/repositories';
import type { PasswordStrengthPolicyValidator } from './strength/policy';
import type { AccountModel } from '../../types/models';
import type { SecretEncryptor } from '../../helpers/secret-encryptor';
import type { PasswordHashingAlgorithm } from './hash';

interface PasswordHashingOptions {
	/**
	 * Mapping between password hashing algorithms and their id's.
	 */
	algorithms: ReadonlyMap<number, PasswordHashingAlgorithm>;
	/**
	 * Id the current password hashing algorithm.
	 */
	currentAlgorithmId: number;
	/**
	 * Current hashing algorithm. This algorithm will be used to hash passwords of the newly registered accounts.
	 */
	currentAlgorithm: PasswordHashingAlgorithm;
}

/**
 * Manages user passwords. <br/>
 * Implementation ideas were taken from [here](https://paragonie.com/blog/2015/04/secure-authentication-php-with-long-term-persistence#title.2).
 *
 * @private
 */
class PasswordsManager<Account extends AccountModel> {
	private readonly hashing: PasswordHashingOptions;

	private readonly encryptor: SecretEncryptor;

	private readonly strength: PasswordStrengthPolicyValidator<Account>[];

	private readonly accountRepository: AccountRepository<Account>;

	public constructor(
		passwordHashing: PasswordHashingOptions,
		passwordEncryptor: SecretEncryptor,
		passwordStrength: PasswordStrengthPolicyValidator<Account>[],
		accountRepository: AccountRepository<Account>
	) {
		this.hashing = passwordHashing;
		this.encryptor = passwordEncryptor;
		this.strength = passwordStrength;
		this.accountRepository = accountRepository;
	}

	public async changeAndStoreOnAccount(newPassword: string, account: Account): Promise<void> {
		await this.hashAndStoreOnAccount(newPassword, account);
		await this.accountRepository.changePassword(account.id, account.passwordHash, account.passwordSalt, account.passwordAlg);
	}

	public async hashAndStoreOnAccount(password: string, account: Account): Promise<void> {
		for (const validator of this.strength) {
			await validator.validate(password, account);
		}

		const hash = await this.hashing.currentAlgorithm.hash(password);

		account.passwordHash = this.encryptor.encrypt(hash.passwordHash);
		account.passwordSalt = hash.passwordSalt;
		account.passwordAlg = this.hashing.currentAlgorithmId;
	}

	public async isSame(plain: string, hash: string, salt: string | undefined | null, algorithmId: number): Promise<boolean> {
		hash = this.encryptor.decrypt(hash);
		return this.hashing.algorithms.get(algorithmId)!.verify(plain, hash, salt);
	}
}

export { PasswordsManager, PasswordHashingOptions };
