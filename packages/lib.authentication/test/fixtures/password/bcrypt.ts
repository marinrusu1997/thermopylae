import { hash, compare } from 'bcrypt';
import { PasswordHash, PasswordHashingAlgorithm } from '../../../lib';

class BcryptPasswordHashingAlgorithm implements PasswordHashingAlgorithm {
	public async hash(password: string): Promise<PasswordHash> {
		return { passwordHash: await hash(password, 3) };
	}

	public async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
		return compare(plainPassword, hashedPassword);
	}
}

export { BcryptPasswordHashingAlgorithm };
