import { authenticator } from 'otplib';
import crypto from 'crypto';
import { createException } from './exception';
import { ErrorCodes } from './errors';

const { Authenticator } = authenticator;

interface Options {
	ttl: number; // in seconds
	secret: string;
}

/** Class for operations which TOTP tokens */
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
	 * Generates TOTP
	 *
	 * @returns {string}
	 */
	generate(): string {
		return this.impl.generate(this.secret);
	}

	/**
	 * Checks the provided TOTP against signature and stored TOTP
	 *
	 * @param {string}	received	Received plain TOTP. His signature will be verified.
	 * @param {string}	[stored]    Stored plain TOTP. If provided, equality check will be provided against it.
	 * @param {*}  		[logger]    Logger object which will log check signature failures
	 *
	 * @returns {boolean}   Status if TOTP is correct
	 */
	check(received: string, stored?: string, logger?: any): boolean {
		try {
			return stored ? stored === received && this.impl.check(received, this.secret) : this.impl.check(received, this.secret);
		} catch (error) {
			/* istanbul ignore next */
			(logger || console).error(createException(ErrorCodes.CHECKING_FAILED, 'Failed to check TOTP signature', error));
		}
		/* istanbul ignore next */
		return false;
	}
}

export { Totp };
