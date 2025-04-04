import { Authenticator } from '@otplib/core';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import type { Seconds } from '@thermopylae/core.declarations';
import { createException } from './exception.js';

/** {@link Totp} construction options. */
interface Options {
	/** Number of seconds after which TOTP is considered invalid. */
	ttl: Seconds;
	/** Secret used for TOTP generation. */
	secret: string;
}

const enum ErrorCodes {
	TOTP_CHECK_FAILED = 'TOTP_CHECK_FAILED'
}

/** Class responsible for manipulations with TOTP tokens. */
class Totp {
	private readonly impl: Authenticator;

	private readonly secret: string;

	public constructor(opts: Options) {
		this.impl = new Authenticator({
			step: opts.ttl,
			createDigest,
			createRandomBytes,
			keyDecoder,
			keyEncoder
		});
		this.secret = opts.secret;
	}

	/**
	 * Generates TOTP.
	 *
	 * @returns Generated TOTP.
	 */
	public generate(): string {
		return this.impl.generate(this.secret);
	}

	/**
	 * Checks the provided TOTP against signature and stored TOTP.
	 *
	 * @param   received     Received plain TOTP. His signature will be verified.
	 * @param   [stored]     Stored plain TOTP. If provided, equality check will be provided against
	 *   it.
	 * @param   [logger]     Logger object which will log check signature failures.
	 * @param   logger.error
	 *
	 * @returns              Whether TOTP is valid.
	 */
	public check(received: string, stored?: string, logger?: { error: (err: Error) => void }): boolean {
		try {
			return stored ? stored === received && this.impl.check(received, this.secret) : this.impl.check(received, this.secret);
		} catch (error) {
			(logger || console).error(createException(ErrorCodes.TOTP_CHECK_FAILED, 'Failed to check TOTP signature', error as Error));
		}
		return false;
	}
}

export { Totp, ErrorCodes };
