import { Exception } from '@thermopylae/lib.exception';
import { object } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { AuthenticationEngine, ErrorCodes } from '../lib/index.js';
import { AuthenticationEngineDefaultOptions } from './fixtures/index.js';

describe('AuthEngine spec', function suite() {
	it('validates password similarity coefficient', () => {
		const options = object.cloneDeep(AuthenticationEngineDefaultOptions);
		// @ts-ignore This is for test purposes
		options.password['similarity'] = -1;

		let err;
		try {
			new AuthenticationEngine(options);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INVALID_PASSWORD_SIMILARITY_VALUE);
		expect(err).to.haveOwnProperty('message', `Password similarity threshold needs to be in range [0, 1]. Given: ${options.password.similarity}.`);

		// @ts-ignore This is for test purposes
		options.password['similarity'] = 1.1;

		err = null;
		try {
			new AuthenticationEngine(options);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INVALID_PASSWORD_SIMILARITY_VALUE);
		expect(err).to.haveOwnProperty('message', `Password similarity threshold needs to be in range [0, 1]. Given: ${options.password.similarity}.`);
	});

	it('validates tokens length', () => {
		const options = object.cloneDeep(AuthenticationEngineDefaultOptions);
		// @ts-ignore This is for test purposes
		options['tokensLength'] = -1;

		let err;
		try {
			new AuthenticationEngine(options);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INVALID_TOKENS_LENGTH);
		expect(err).to.haveOwnProperty('message', `Tokens length can't be lower than 15 characters. Given: ${options.tokensLength}.`);
	});
});
