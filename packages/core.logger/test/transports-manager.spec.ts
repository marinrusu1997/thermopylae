import { chai } from '@thermopylae/dev.unit-test';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import fs from 'fs';
import process from 'process';
import { ConsoleLogsManager } from '../lib/transports/console';
import { FileLogsManager } from '../lib/transports/file';
import { GrayLogsManager } from '../lib/transports/graylog';
import { TransportsManager } from '../lib/transports-manager';
import { formatCurrentDate, unlinkAsync } from './utils';

const { expect } = chai;

describe(`${TransportsManager.name} spec`, () => {
	const logFileName = `test/log.${process.pid}.${formatCurrentDate()}`;

	afterEach(async function () {
		if (fs.existsSync(logFileName)) {
			await unlinkAsync(logFileName);
		}
	});

	it('throws when no transport managers registered', () => {
		expect(() => new TransportsManager().for('realsys')).to.throw('No transports were configured for realsys.');
	});

	it('returns transports from registered managers', async () => {
		const instance = new TransportsManager();
		const console = new ConsoleLogsManager();
		const file = new FileLogsManager();
		const graylog = new GrayLogsManager();

		instance.register([console, file, graylog]);
		expect(() => new TransportsManager().for('realsys')).to.throw('No transports were configured for realsys.');

		console.createTransport({ level: 'info' });
		expect(instance.for('realsys')).to.be.array().ofSize(1);

		file.createTransport({ level: 'info', filename: 'test/log' });
		expect(fs.existsSync(logFileName));
		expect(instance.for('realsys')).to.be.array().ofSize(2);

		graylog.register('input', { host: 'somehost', port: 1 });
		graylog.setChannel('realsys', { level: 'info', input: 'input' });
		expect(instance.for('realsys')).to.be.array().ofSize(3);
	});
});
