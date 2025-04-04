import type { ObjMap } from '@thermopylae/core.declarations';
import { describe, expect, it } from 'vitest';
import { ApiValidator } from '../lib/index.js';
import { apiValidator } from './bootstrap.js';

describe(`${ApiValidator.prototype.validate.name} spec`, () => {
	it('validates schemas', async () => {
		const car = { model: 'BMW', engine: 8 };
		expect(await apiValidator.validate('CAR_SERVICE', 'car', car)).to.be.deep.eq(car);
	});

	it('fails to validate schemas', async () => {
		const car = { model: 'DACIA', engine: 8 };

		let err: (Error & ObjMap) | null = null;
		try {
			await apiValidator.validate('CAR_SERVICE', 'car', car);
		} catch (e) {
			err = e;
		}
		expect(apiValidator.joinErrors(err!.errors, 'text')).to.be.eq('data/model must be equal to one of the allowed values');
	});
});
