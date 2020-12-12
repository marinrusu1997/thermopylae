import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Firewall } from '../lib';

describe('validate spec', () => {
	it('loads schemas and validates them', async () => {
		await Firewall.init('test/fixtures', ['core']);
		const car = { model: 'BMW', engine: 8 };
		expect(await Firewall.validate('CAR_SERVICE', 'car', car)).to.be.deep.eq(car);
	});
});
