import { describe, it } from 'mocha';
import { expect } from 'chai';
// eslint-disable-next-line import/extensions
import ValidationError from 'ajv/dist/runtime/validation_error';
import { ApiValidator } from '../lib';
import { apiValidator } from './bootstrap';

describe(`${ApiValidator.prototype.validate.name} spec`, () => {
	it('validates schemas', async () => {
		const car = { model: 'BMW', engine: 8 };
		expect(await apiValidator.validate('CAR_SERVICE', 'car', car)).to.be.deep.eq(car);
	});

	it('fails to validate schemas', async () => {
		const car = { model: 'DACIA', engine: 8 };

		let err: ValidationError | null = null;
		try {
			await apiValidator.validate('CAR_SERVICE', 'car', car);
		} catch (e) {
			err = e;
		}

		expect(apiValidator.joinErrors(err!.errors, 'text')).to.be.eq('data/model must be equal to one of the allowed values');
	});
});
