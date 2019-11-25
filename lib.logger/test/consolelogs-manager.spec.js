import { describe, it } from 'mocha';
import { chai } from './chai';
import { ConsoleLogsManager } from '../lib/transports/consolelogs-manager';

describe('Console logs manager spec', () => {
	const { expect } = chai;

	it('does not create default transport when created', () => {
		expect(new ConsoleLogsManager().get()).to.be.equal(null);
	});

	it('creates transport after set config with explicit provided options', () => {
		const instance = new ConsoleLogsManager();
		instance.setConfig({ level: 'error' });
		const transports = instance.get();
		expect(transports).to.have.property('name', 'console');
		expect(transports).to.have.property('level', 'error');
	});
});
