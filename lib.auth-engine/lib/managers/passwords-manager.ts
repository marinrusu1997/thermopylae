import { http, token } from '@marin/lib.utils';
import owasp from 'owasp-password-strength-test';
import argon2 from 'argon2';
import crypto from 'crypto';
import { createException, ErrorCodes } from '../error';

class PasswordsManager {
	private readonly breachThreshold: number;

	constructor(breachThreshold: number) {
		this.breachThreshold = breachThreshold;
	}

	public async validateStrengthness(password: string): Promise<void> {
		const result = owasp.test(password);
		if (!result.strong) {
			throw createException(ErrorCodes.WEAK_PASSWORD, result.errors.join('.\n'));
		}

		const hash = crypto
			.createHash('sha1')
			.update(password, 'utf8')
			.digest('hex')
			.toUpperCase();
		const prefix = hash.substr(0, 5);
		const suffix = hash.substr(5);

		const response = await http.makeHTTPSRequest('https://api.pwnedpasswords.com', { path: `/range/${prefix}` });
		const breachedPasswords = response.split('\n');

		for (let i = 0; i < breachedPasswords.length; i += 1) {
			const [entry, howOften] = breachedPasswords[i].split(':');
			if (entry === suffix && Number(howOften) >= this.breachThreshold) {
				// after owasp test chances that chosen password was breached before are very low
				/* istanbul ignore next */
				throw createException(ErrorCodes.WEAK_PASSWORD, 'Your password has been breached before. We strongly recommend you to choose another one.');
			}
		}
	}

	public static generateSalt(size: number): Promise<string> {
		return token.generateToken(size).then(tokens => tokens.plain);
	}

	public static hash(password: string, salt: string, pepper: string): Promise<string> {
		return argon2.hash(PasswordsManager.padeAndHash(password, salt, pepper), { type: argon2.argon2id });
	}

	public static isCorrect(plain: string, hash: string, salt: string, pepper: string): Promise<boolean> {
		return argon2.verify(hash, PasswordsManager.padeAndHash(plain, salt, pepper), { type: argon2.argon2id });
	}

	private static padeAndHash(password: string, salt: string, pepper: string): string {
		const paddedPassword = salt.concat(password, pepper);
		return crypto
			.createHash('sha512')
			.update(paddedPassword, 'utf8')
			.digest('hex');
	}
}

export { PasswordsManager };
