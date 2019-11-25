import { describe, it } from 'mocha';
import { MemoryStorage } from '../../../lib/blacklisting/storage/memory';
import { chai } from '../../chai';
import { nowInSeconds } from '../../../lib/utils';
import { sleep } from '../../utils';

describe('Memory storage spec', () => {
	const storage = new MemoryStorage();
	const { expect } = chai;

	it('throws when audience contains special separator character (whitespace)', async () => {
		await expect(storage.defineAudience(' audience', 1)).to.eventually.be.rejectedWith(
			"Audience cannot contain ' ' character"
		);
		await expect(storage.defineAudience('audi ence', 1)).to.eventually.be.rejectedWith(
			"Audience cannot contain ' ' character"
		);
		await expect(storage.defineAudience('audience ', 1)).to.eventually.be.rejectedWith(
			"Audience cannot contain ' ' character"
		);
		await storage.clear();
	});

	it('throws if audience is defined already', async () => {
		await storage.defineAudience('audience', 1);
		await expect(storage.defineAudience('audience', 1)).to.eventually.be.rejectedWith(
			'Audience audience was defined already'
		);
		await storage.clear();
	});

	it('throws on revoke/purge if audience not defined', async () => {
		await expect(storage.revoke('notdefined', '1', 1)).to.eventually.be.rejectedWith(
			'Audience notdefined not defined'
		);
		await expect(storage.purge('notdefined', '1')).to.eventually.be.rejectedWith('Audience notdefined not defined');
		await storage.clear();
	});

	it('does not try to remove tokens if they are empty', async () => {
		const audience = 'audience';
		await storage.defineAudience(audience, 1);
		const now = nowInSeconds();
		await storage.revoke(audience, '1', now);
		await storage.clear();
		await sleep(1100);
		await storage.clear();
	});
});
