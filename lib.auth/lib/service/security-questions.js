import { hashToken, compareTokens, ErrorCodes, ErrorMessages } from '@marin/lib.utils';
import { createException } from '../error';

/**
 * @interface ISecurityQuestionsOptions
 *
 * @property {ISecurityQuestionsOperations} securityQuestionsModel
 */

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {ISecurityQuestionsOptions}
 */
const internal = _this => {
	return storage.get(_this);
};

/**
 * @param {string}	answer
 * @returns {Promise<string>}
 */
async function hashAnswer(answer) {
	return hashToken(answer.toLowerCase());
}

/**
 * @param {string}	hash		Hash of the answer
 * @param {string}	received	Plain received answer
 *
 * @returns {Promise<boolean>}
 */
async function checkAnswer(hash, received) {
	return compareTokens(hash, received.toLowerCase(), true);
}

/** Helper class for Auth Service which is responsible for operations with security questions */
class SecurityQuestions {
	/**
	 * @param {ISecurityQuestionsOptions} options
	 */
	constructor(options) {
		storage.set(this, options);
	}

	/**
	 * @param {SecurityQuestionLanguage} lang
	 * @return {Promise<Array<ISecurityQuestion>>}
	 */
	async getCannedOnes(lang) {
		return internal(this).securityQuestionsModel.readQuestions('@system', lang);
	}

	/**
	 * @param {number} accountId
	 * @returns {Promise<ISecurityQuestion>}
	 */
	async getUserOne(accountId) {
		return (await internal(this).securityQuestionsModel.readQuestions(accountId))[0];
	}

	/**
	 * @param {number} accountId
	 * @param {SecurityQuestionLanguage} lang
	 * @return {Promise<Array<ISecurityQuestion>>}
	 */
	async getAll(accountId, lang) {
		return internal(this).securityQuestionsModel.readQuestions(`@all.${accountId}`, lang);
	}

	/**
	 * @param {number} accountId
	 * @param {string} question
	 * @param {string} answer
	 * @returns {Promise<void>}
	 */
	async setQuestion(accountId, question, answer) {
		const { securityQuestionsModel } = internal(this);
		const hash = await hashAnswer(answer);
		await securityQuestionsModel.setQuestion(accountId, question, hash);
	}

	/**
	 * @param {number}				accountId
	 * @param {Map<number, string>}	answers
	 * @returns {Promise<void>}
	 */
	async setAnswers(accountId, answers) {
		const { securityQuestionsModel } = internal(this);
		const answersToStore = new Map();
		const promises = [];
		// eslint-disable-next-line no-restricted-syntax
		for (const [questionId, answer] of answers.entries()) {
			promises.push(
				(async () => {
					answersToStore.set(questionId, await hashAnswer(answer));
				})()
			);
		}
		await Promise.all(promises);
		await securityQuestionsModel.setAnswers(accountId, answersToStore);
	}

	/**
	 * @param {number}	accountId
	 * @param {number}	questionId
	 * @param {string}	answer
	 *
	 * @throws {Exception}
	 * @returns {Promise<boolean>}
	 */
	async checkAnswer(accountId, questionId, answer) {
		const { securityQuestionsModel } = internal(this);
		const answerHash = await securityQuestionsModel.readAnswer(accountId, questionId);
		if (!answerHash) {
			throw createException(ErrorCodes.INCORRECT_QUESTION, ErrorMessages.INCORRECT_QUESTION);
		}
		return checkAnswer(answerHash, answer);
	}

	/**
	 * @param {number}				accountId
	 * @param {Map<number, string>}	answers
	 * @param {boolean}				[accumulate] Does an and of all the checks
	 * @returns {Promise<Map<number,boolean> | boolean>}
	 */
	async checkAnswerBulk(accountId, answers, accumulate) {
		const { securityQuestionsModel } = internal(this);
		const answerHashes = await securityQuestionsModel.readAnswers(accountId);
		const /** @type {Map<number, boolean>} */ results = new Map();
		const promises = [];
		// eslint-disable-next-line no-restricted-syntax
		for (const [questionId, answer] of answers.entries()) {
			promises.push(
				(async () => {
					results.set(questionId, await checkAnswer(answerHashes.get(questionId), answer));
				})()
			);
		}
		await Promise.all(promises);
		if (accumulate) {
			// eslint-disable-next-line no-restricted-syntax
			for (const result of results.values()) {
				if (!result) {
					return false;
				}
			}
			return true;
		}
		return results;
	}
}

// eslint-disable-next-line import/prefer-default-export
export { SecurityQuestions };
