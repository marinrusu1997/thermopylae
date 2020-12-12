import { authenticator } from 'otplib';
import crypto from 'crypto';
import { Seconds } from '@thermopylae/core.declarations';
import { createException } from './exception';

const { Authenticator } = authenticator;

/**
 * {@link Totp} construction options.
 */
interface Options {
	/**
	 * Number of seconds after which TOTP is considered invalid.
	 */
	ttl: Seconds;
	/**
	 * Secret used for TOTP generation.
	 */
	secret: string;
}

const enum ErrorCodes {
	TOTP_CHECK_FAILED = 'TOTP_CHECK_FAILED'
}

/**
 * Class responsible for manipulations with TOTP tokens.
 */
class Totp {
	private readonly impl: Authenticator;

	private readonly secret: string;

	constructor(opts: Options) {
		this.impl = new Authenticator();
		this.impl.options = {
			step: opts.ttl,
			crypto
		};
		this.secret = opts.secret;
	}

	/**
	 * Generates TOTP.
	 *
	 * @returns Generated TOTP.
	 */
	generate(): string {
		return this.impl.generate(this.secret);
	}

	/**
	 * Checks the provided TOTP against signature and stored TOTP.
	 *
	 * @param received 		Received plain TOTP. His signature will be verified.
	 * @param [stored]    	Stored plain TOTP. If provided, equality check will be provided against it.
	 * @param [logger]    	Logger object which will log check signature failures
	 * @param logger.error
	 * @returns Whether TOTP is valid.
	 */
	check(received: string, stored?: string, logger?: { error: (err: Error) => void }): boolean {
		try {
			return stored ? stored === received && this.impl.check(received, this.secret) : this.impl.check(received, this.secret);
		} catch (error) {
			(logger || console).error(createException(ErrorCodes.TOTP_CHECK_FAILED, 'Failed to check TOTP signature', error));
		}
		return false;
	}
}

export { Totp, ErrorCodes };
