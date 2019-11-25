import { describe, it } from 'mocha';
import { chai } from './chai';

const { expect } = chai;

describe('email', () => {
	it('not tested', () => {
		expect('TESTED').to.be.equal('NOT TESTED');
	});
});
