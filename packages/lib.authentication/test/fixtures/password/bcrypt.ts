import { compare, hash } from 'bcrypt';
import type { PasswordHash, PasswordHashingAlgorithm } from '../../../lib/index.js';

class BcryptPasswordHashingAlgorithm implements PasswordHashingAlgorithm {
	public async hash(password: string): Promise<PasswordHash> {
		return { passwordHash: await hash(password, 3) };
	}

	public async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
		return compare(plainPassword, hashedPassword);
	}
}

export { BcryptPasswordHashingAlgorithm };
