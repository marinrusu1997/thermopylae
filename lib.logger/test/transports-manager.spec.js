import { describe, it } from 'mocha';
import fs from 'fs';
import util from 'util';
import process from 'process';
import { chai } from './chai';
import { currentDate } from './utils';
import { ConsoleLogsManager } from '../lib/transports/consolelogs-manager';
import { FileLogsManager } from '../lib/transports/filelogs-manager';
import { GrayLogsManager } from '../lib/transports/graylogs-manager';
import { TransportsManager } from '../lib/transports/transports-manager';

describe('Transports manager spec', () => {
	const { expect } = chai;
	const unlink = util.promisify(fs.unlink);

	it('throws when no transport managers registered', () => {
		expect(() => new TransportsManager().for('realsys')).to.throw('No transports for realsys');
	});

	it('returns transports from registered managers', async () => {
		const instance = new TransportsManager();
		const console = new ConsoleLogsManager();
		const file = new FileLogsManager();
		const graylog = new GrayLogsManager();
		instance.register(console, file, graylog);
		expect(() => new TransportsManager().for('realsys')).to.throw('No transports for realsys');
		console.setConfig({ level: 'info' });
		expect(instance.for('realsys'))
			.to.be.array()
			.ofSize(1);
		file.setConfig({ level: 'info' });
		expect(instance.for('realsys'))
			.to.be.array()
			.ofSize(2);
		graylog.register('input', { host: 'somehost', port: 1 });
		graylog.recipeFor('realsys', { level: 'info', input: 'input' });
		expect(instance.for('realsys'))
			.to.be.array()
			.ofSize(3);
		await unlink(`undefined.${process.pid}.${currentDate()}`);
	});
});
