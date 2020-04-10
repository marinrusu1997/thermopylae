import crypto from '@ronomon/crypto-async';
import argon2 from 'argon2';
import bcrypt from 'bcrypt';
import { PasswordHash, PasswordHasherInterface } from '../../lib/managers/passwords-manager';

const enum HashingAlgorithms {
	ARGON2 = 0,
	BCRYPT = 1
}

class PasswordHasher implements PasswordHasherInterface {
	private static readonly WEAK_HASH_ALG = 'sha256';

	private static readonly SALT_ROUNDS = 10;

	private static readonly ARGON2_HASHING_OPTS = { type: argon2.argon2id };

	private readonly pepper: string;

	private readonly hashingAlg: HashingAlgorithms;

	constructor(pepper: string, hashingAlg: HashingAlgorithms) {
		this.pepper = pepper;
		this.hashingAlg = hashingAlg;
	}

	public async hash(password: string): Promise<PasswordHash> {
		const salt = await PasswordHasher.generateSalt();
		return {
			hash: await this.generateHash(password, salt),
			salt,
			alg: this.hashingAlg
		};
	}

	public async verify(passwordHash: PasswordHash, plain: string): Promise<boolean> {
		const weakPasswordHash = await this.generateWeakHash(plain, passwordHash.salt);

		switch (passwordHash.alg) {
			case HashingAlgorithms.ARGON2:
				return argon2.verify(passwordHash.hash, weakPasswordHash, PasswordHasher.ARGON2_HASHING_OPTS);
			case HashingAlgorithms.BCRYPT:
				return bcrypt.compare(weakPasswordHash, passwordHash.hash);
			default:
				throw new Error('UNKNOWN HASHING ALGORITHM');
		}
	}

	private generateWeakHash(password: string, salt: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const paddedPassword = Buffer.from(salt.concat(password, this.pepper), 'utf8');
			const callback = (error: Error | undefined, hash: Buffer): void => {
				return error ? reject(error) : resolve(hash.toString('hex'));
			};
			return crypto.hash(PasswordHasher.WEAK_HASH_ALG, paddedPassword, callback);
		});
	}

	private static generateSalt(): Promise<string> {
		return bcrypt.genSalt(PasswordHasher.SALT_ROUNDS);
	}

	private async generateHash(password: string, salt: string): Promise<string> {
		const weakPasswordHash = await this.generateWeakHash(password, salt);

		switch (this.hashingAlg) {
			case HashingAlgorithms.ARGON2:
				return argon2.hash(weakPasswordHash, PasswordHasher.ARGON2_HASHING_OPTS);
			case HashingAlgorithms.BCRYPT:
				return bcrypt.hash(weakPasswordHash, salt);
			default:
				throw new Error('UNKNOWN HASHING ALGORITHM');
		}
	}
}

export { HashingAlgorithms, PasswordHasher };
