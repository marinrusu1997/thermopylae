import { chai } from '@thermopylae/lib.unit-test';
import { describe, it } from 'mocha';
import { ConsoleLogsManager } from '../lib/transports/console';

const { expect } = chai;

describe(`${ConsoleLogsManager.name} spec`, () => {
	it('does not create default transport when created', () => {
		expect(new ConsoleLogsManager().get()).to.be.equal(null);
	});

	it('creates transport after set config with explicit provided options', () => {
		const instance = new ConsoleLogsManager();
		instance.createTransport({ level: 'error' });
		const transports = instance.get();
		expect(transports).to.have.property('name', 'console');
		expect(transports).to.have.property('level', 'error');
	});
});
