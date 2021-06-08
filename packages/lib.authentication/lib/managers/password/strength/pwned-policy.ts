import { ErrorCodes as CoreErrorCodes } from '@thermopylae/core.declarations';
import type { Threshold } from '@thermopylae/core.declarations';
import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { createException, ErrorCodes } from '../../../error';
import type { PasswordStrengthPolicyValidator } from './policy';
import type { AccountModel } from '../../../types/models';

class PwnedPasswordValidator<Account extends AccountModel> implements PasswordStrengthPolicyValidator<Account> {
	private readonly breachThreshold: Threshold;

	public constructor(breachThreshold: Threshold) {
		this.breachThreshold = breachThreshold;
	}

	public async validate(password: string): Promise<void | never> {
		const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
		const prefix = hash.substr(0, 5);
		const suffix = hash.substr(5);

		const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
		if (!response.ok) {
			throw createException(
				CoreErrorCodes.API_ERROR,
				`Pwned password query failed. ${response.status} ${response.statusText}. ${await response.text()}.`
			);
		}

		const breachedPasswords = (await response.text()).split('\n');
		let entry: string;
		let howOften: string;

		for (let i = 0; i < breachedPasswords.length; i += 1) {
			[entry, howOften] = breachedPasswords[i].split(':');
			if (entry === suffix && Number(howOften) >= this.breachThreshold) {
				throw createException(ErrorCodes.WEAK_PASSWORD, 'Provided password has been breached before.', password);
			}
		}
	}
}

export { PwnedPasswordValidator };
