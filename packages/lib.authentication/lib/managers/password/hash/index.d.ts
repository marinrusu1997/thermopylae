interface PasswordHash {
	/**
	 * Hash of the password.
	 */
	passwordHash: string;
	/**
	 * Password salt. Optional, might be encoded in the {@link PasswordHash.passwordHash}.
	 */
	passwordSalt?: string;
}

/**
 * Algorithm used for password hashing.
 */
interface PasswordHashingAlgorithm {
	/**
	 * Hashes password.
	 *
	 * @param password		Plaintext password.
	 *
	 * @returns				Password hash.
	 */
	hash(password: string): Promise<PasswordHash>;

	/**
	 * Verifies password.
	 *
	 * @param plain		Plaintext password.
	 * @param hash		Password hash.
	 * @param salt		Password salt.
	 *
	 * @returns			Whether password is valid.
	 */
	verify(plain: string, hash: string, salt?: string | null): Promise<boolean>;
}

export { PasswordHash, PasswordHashingAlgorithm };
