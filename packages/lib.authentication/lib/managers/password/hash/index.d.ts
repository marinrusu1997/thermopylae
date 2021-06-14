interface PasswordHash {
	passwordHash: string;
	/**
	 * Optional, might be encoded in the hash.
	 */
	passwordSalt?: string;
}

interface PasswordHashingAlgorithm {
	hash(password: string): Promise<PasswordHash>;
	verify(plain: string, hash: string, salt?: string | null): Promise<boolean>;
}

export { PasswordHash, PasswordHashingAlgorithm };
