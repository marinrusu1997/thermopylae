import { ErrorCodes, makeHTTPSRequest } from '@marin/lib.utils';
import { createHash, randomBytes as randomBytesCb } from 'crypto';
import { promisify } from 'util';
import { argon2id, hash as hashFun, verify } from 'argon2';
import owasp from 'owasp-password-strength-test';
import { createException } from '../error';

/**
 * @typedef {{
 * 		breachThreshold: number,
 * 		accountModel: IAccountOperations
 * }} IPasswordsManagerOptions
 */

/**
 * Promisified version of `randomBytes`
 *
 * @type {function (size: number): Promise<Buffer>}
 */
const randomBytes = promisify(randomBytesCb);

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {IPasswordsManagerOptions}
 */
const internal = _this => {
	return storage.get(_this);
};

/**
 * Pads the plain password with salt on left side and pepper on right side
 *
 * @param {string}  password    Plain password
 * @param {string}  salt        Salt to be used
 * @param {string}  pepper      Pepper to be used
 *
 * @returns {string}
 */
function hashOfPaddedPassword(password, salt, pepper) {
	const paddedPassword = salt.concat(password, pepper);
	return createHash('sha512')
		.update(paddedPassword, 'utf8')
		.digest('hex');
}

class PasswordsManager {
	/**
	 * @param {IPasswordsManagerOptions} options
	 */
	constructor(options) {
		storage.set(this, options);
	}

	/**
	 * @param {number} size
	 * @returns {Promise<string>}
	 */
	static async generateSalt(size) {
		return (await randomBytes(size)).toString('hex');
	}

	/**
	 * @param {string}	password
	 * @param {string} 	salt
	 * @param {string}	pepper
	 * @returns {Promise<string>}
	 */
	static async hash(password, salt, pepper) {
		return hashFun(hashOfPaddedPassword(password, salt, pepper), {
			type: argon2id
		});
	}

	/**
	 * @param {string}  password          Plain password
	 *
	 * @throws {Exception|Error}
	 * @returns {Promise<void>}
	 */
	async validateStrengthness(password) {
		const { breachThreshold } = internal(this);

		const hash = createHash('sha1')
			.update(password, 'utf8')
			.digest('hex')
			.toUpperCase();
		const prefix = hash.substr(0, 5);
		const suffix = hash.substr(5);
		const response = await makeHTTPSRequest({
			hostname: 'api.pwnedpasswords.com',
			path: `/range/${prefix}`
		});
		const breachedPasswords = response.split('\n');
		let isBreached = false;
		for (let i = 0; i < breachedPasswords.length; i += 1) {
			const [entry, howOften] = breachedPasswords[i].split(':');
			if (entry === suffix && Number(howOften) >= breachThreshold) {
				isBreached = true;
				break;
			}
		}

		let /** @type {Array<string>} */ messages = [];
		if (isBreached) {
			messages.push('Your password has been breached before. We strongly recommend you to choose another one');
		} else {
			const result = owasp.test(password);
			if (!result.strong) {
				messages = result.errors;
			}
		}

		if (messages.length !== 0) {
			throw createException(ErrorCodes.INVALID_PASSWORD, messages.join('.\n'));
		}
	}

	/**
	 * @param {string} 	plain
	 * @param {string} 	hash
	 * @param {string}	salt
	 * @param {string}	pepper
	 * @returns {Promise<boolean>}
	 */
	static async isCorrect(plain, hash, salt, pepper) {
		const passwordSHA512 = hashOfPaddedPassword(plain, salt, pepper);
		return verify(hash, passwordSHA512, { type: argon2id });
	}

	/**
	 * @param {number}	accountId
	 * @param {string} 	newPass
	 * @param {string} 	[oldPass]
	 * @param {string} 	[salt]
	 * @param {string} 	[pepper]
	 *
	 * @throws {Exception|Error}
	 * @returns {Promise<void>}
	 */
	async change(accountId, newPass, oldPass, salt, pepper) {
		if (oldPass && !(await PasswordsManager.isCorrect(newPass, oldPass, salt, pepper))) {
			throw createException(ErrorCodes.INCORRECT_CREDENTIALS, 'Incorrect password');
		}
		await this.validateStrengthness(newPass);
		const hash = await PasswordsManager.hash(newPass, salt, pepper);
		await internal(this).accountModel.changePassword(accountId, hash);
	}
}

// eslint-disable-next-line import/prefer-default-export
export { PasswordsManager };
