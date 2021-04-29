import { http } from '@thermopylae/lib.utils';
import owasp from 'owasp-password-strength-test';
import crypto from 'crypto';
import { createException, ErrorCodes } from '../error';
import { AccountEntity } from '../types/entities';

interface PasswordHash {
	hash: string;
	salt: string;
	alg: number;
}

interface PasswordHasherInterface {
	hash(password: string): Promise<PasswordHash>;
	verify(hash: PasswordHash, plain: string): Promise<boolean>;
	getHashingAlgorithm(): number;
}

class PasswordsManager {
	private readonly breachThreshold: number;

	private readonly accountEntity: AccountEntity;

	private readonly passwordHasher: PasswordHasherInterface;

	constructor(breachThreshold: number, accountEntity: AccountEntity, passwordHasher: PasswordHasherInterface) {
		this.breachThreshold = breachThreshold;
		this.accountEntity = accountEntity;
		this.passwordHasher = passwordHasher;
	}

	public async validateStrengthness(password: string): Promise<void> {
		const result = owasp.test(password);
		if (!result.strong) {
			throw createException(ErrorCodes.WEAK_PASSWORD, result.errors.join('.\n'));
		}

		const hash = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
		const prefix = hash.substr(0, 5);
		const suffix = hash.substr(5);

		const response = await http.requestSecure('https://api.pwnedpasswords.com', { path: `/range/${prefix}` });
		const breachedPasswords = (response.data as string).split('\n');

		for (let i = 0; i < breachedPasswords.length; i += 1) {
			const [entry, howOften] = breachedPasswords[i].split(':');
			if (entry === suffix && Number(howOften) >= this.breachThreshold) {
				// after owasp test chances that chosen password was breached before are very low
				throw createException(ErrorCodes.WEAK_PASSWORD, 'Provided password has been breached before. ', password);
			}
		}
	}

	public async change(accountId: string, newPassword: string): Promise<void> {
		await this.validateStrengthness(newPassword);
		const passwordHash = await this.hash(newPassword);
		await this.accountEntity.changePassword(accountId, passwordHash.hash, passwordHash.salt, passwordHash.alg);
	}

	public hash(password: string): Promise<PasswordHash> {
		return this.passwordHasher.hash(password);
	}

	public isSame(plain: string, hash: PasswordHash): Promise<boolean> {
		return this.passwordHasher.verify(hash, plain);
	}
}

export { PasswordsManager, PasswordHash, PasswordHasherInterface };
