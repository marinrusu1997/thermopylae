import { http } from '@marin/lib.utils';
import { promisify } from 'util';
import owasp from 'owasp-password-strength-test';
import argon2 from 'argon2';
import crypto from 'crypto';
import { createException, ErrorCodes } from '../error';

const randomBytes = promisify(crypto.randomBytes);

class PasswordsManager {
	private readonly breachThreshold: number;

	constructor(breachThreshold: number) {
		this.breachThreshold = breachThreshold;
	}

	public async validateStrengthness(password: string): Promise<void> {
		const hash = crypto
			.createHash('sha1')
			.update(password, 'utf8')
			.digest('hex')
			.toUpperCase();
		const prefix = hash.substr(0, 5);
		const suffix = hash.substr(5);

		const response = await http.makeHTTPSRequest('api.pwnedpasswords.com', { path: `/range/${prefix}` });
		const breachedPasswords = response.split('\n');

		for (let i = 0; i < breachedPasswords.length; i += 1) {
			const [entry, howOften] = breachedPasswords[i].split(':');
			if (entry === suffix && Number(howOften) >= this.breachThreshold) {
				throw createException(ErrorCodes.INVALID_ARGUMENT, 'Your password has been breached before. We strongly recommend you to choose another one');
			}
		}

		const result = owasp.test(password);
		if (!result.strong) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, result.errors.join('.\n'));
		}
	}

	public static generateSalt(size: number): Promise<string> {
		return randomBytes(size).then((bytes: Buffer) => bytes.toString('hex'));
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
