import redis from 'redis-mock';
import bluebird from 'bluebird';
import { describe, it } from 'mocha';
import { chai } from '../../chai';
import { sleep } from '../../utils';
import { nowInSeconds } from '../../../lib/utils';
import { MemoryStorage } from '../../../lib/blacklisting/storage/memory';
import { RedisStorage } from '../../../lib/blacklisting/storage/redis';

bluebird.promisifyAll(redis);

describe('Storages spec', () => {
	const storages = [
		{ name: 'MEMORY', storage: new MemoryStorage() },
		{
			name: 'REDIS',
			storage: new RedisStorage({
				redis: redis.createClient(),
				keyPrefix: ' my-key prefix  ',
				clean: true
			})
		}
	];
	const { expect } = chai;

	storages.forEach(({ name, storage }) => {
		it(`${name}: removes correctly revoked tokens for one key`, async () => {
			const audience1 = { name: 'audience1', ttl: 1 };
			const audience2 = { name: 'audience2', ttl: 2 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience1.name, audience1.ttl);
				await storage.defineAudience(audience2.name, audience2.ttl);
			}
			const now = nowInSeconds();
			await storage.revoke(audience1.name, '1', now, audience1.ttl);
			await storage.revoke(audience1.name, '1', now, audience1.ttl);
			await storage.revoke(audience2.name, '1', now, audience2.ttl);
			await sleep(1000);
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.false;
			await sleep(1000);
			await expect(
				storage.has({
					audience: audience2.name,
					subject: '1',
					issued: now,
					ttl: audience2.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience1.name, ['1']], [audience2.name, ['1']]]));
		});

		it(`${name}: removes revoked, then invalidates purge, then removes blacklist`, async () => {
			const audience1 = { name: 'audience1', ttl: 2 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience1.name, audience1.ttl);
			}
			const now = nowInSeconds();
			await storage.revoke(audience1.name, '1', now, audience1.ttl);
			await sleep(1000); // <-- revoke remains 1 second
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.true;
			await storage.purge(audience1.name, '1', audience1.ttl);
			await sleep(1000); // <-- revoke is gone, purge remains 1 second
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.true;
			await sleep(1000); // <-- purge is gone
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience1.name, ['1']]]));
		});

		it(`${name}: removes revoked, invalidates purge, removes revoked, blacklist is empty`, async () => {
			const audience1 = { name: 'audience1', ttl: 2 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience1.name, audience1.ttl);
			}
			const now = nowInSeconds();
			await storage.revoke(audience1.name, '1', now, audience1.ttl);
			await sleep(1000);
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.true;
			await storage.purge(audience1.name, '1', audience1.ttl);
			await sleep(1000); // <-- revoke 1 is gone
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.true;
			await storage.revoke(audience1.name, '1', now + 2, audience1.ttl);
			await sleep(1000); // <-- purge is gone
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now + 2,
					ttl: audience1.ttl
				})
			).to.eventually.be.true;
			await sleep(1000); // <-- revoke 2 is gone
			await expect(
				storage.has({
					audience: audience1.name,
					subject: '1',
					issued: now,
					ttl: audience1.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience1.name, ['1']]]));
		});

		it(`${name}: When purge is cleared, if there are expired revokes, they are removed too`, async () => {
			const audience = { name: 'audience', ttl: 2 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience.name, audience.ttl);
			}
			const now = nowInSeconds();
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await sleep(1000);
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await storage.purge(audience.name, '1', audience.ttl);
			await sleep(1000); // <-- revoke 1 is gone
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await sleep(1000); // <-- purge and revoke 2 is gone
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience.name, ['1']]]));
			await sleep(1000); // let GC finish work
		});

		it(`${name}: GC is restarted after all tokens for user were removed`, async () => {
			const audience = { name: 'audience', ttl: 2 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience.name, audience.ttl);
			}
			let now = nowInSeconds();
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await sleep(1000); // <-- 1 sec remained for revoke
			await storage.purge(audience.name, '1', audience.ttl);
			await sleep(1000); // <-- revoke is gone
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await sleep(1000); // <-- purge is gone
			/* At this moment user entry with tokens was removed */
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			now = nowInSeconds();
			/* This will cause GC restart */
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await sleep(1000); // <-- 1 sec remained for revoke
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			now = nowInSeconds();
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await sleep(1000); // <-- first revoke is gone, 1 sec remaining for second
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await sleep(1000); // <-- second revoke is gone
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience.name, ['1']]]));
		}).timeout(8000);

		it(`${name}: If more audiences have same when to remove field, all of them will be removed in same cicle`, async () => {
			const audience1 = { name: 'audience1', ttl: 1 };
			const audience2 = { name: 'audience2', ttl: 2 };
			const audience3 = { name: 'audience3', ttl: 3 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience1.name, audience1.ttl);
				await storage.defineAudience(audience2.name, audience2.ttl);
				await storage.defineAudience(audience3.name, audience3.ttl);
			}
			/* Schedule in reverse order */
			const now = nowInSeconds();
			await storage.revoke(audience3.name, '1', now, audience3.ttl);
			await sleep(1000); // <-- audience3 remains 2 sec
			await expect(
				storage.has({
					audience: audience3.name,
					issued: now,
					subject: '1',
					ttl: audience3.ttl
				})
			).to.eventually.be.true;
			await storage.purge(audience2.name, '1', audience2.ttl);
			await sleep(1000); // <-- audience3 remains 1 sec, audience2 remains 1 sec
			await expect(
				storage.has({
					audience: audience3.name,
					issued: now,
					subject: '1',
					ttl: audience3.ttl
				})
			).to.eventually.be.true;
			await expect(
				storage.has({
					audience: audience2.name,
					issued: now,
					subject: '1',
					ttl: audience2.ttl
				})
			).to.eventually.be.true;
			await storage.revoke(audience1.name, '1', now, audience1.ttl);
			await sleep(1000); // <-- all audiences are gone
			await expect(
				storage.has({
					audience: audience1.name,
					issued: now,
					subject: '1',
					ttl: audience1.ttl
				})
			).to.eventually.be.false;
			await expect(
				storage.has({
					audience: audience2.name,
					issued: now,
					subject: '1',
					ttl: audience2.ttl
				})
			).to.eventually.be.false;
			await expect(
				storage.has({
					audience: audience3.name,
					issued: now,
					subject: '1',
					ttl: audience3.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience1.name, ['1']], [audience2.name, ['1']], [audience3.name, ['1']]]));
		});

		it(`${name}: If more users from same audience have same when to remove field, all of them will be removed in same cicle`, async () => {
			const audience = { name: 'audience1', ttl: 2 };
			if (storage.defineAudience) {
				await storage.defineAudience(audience.name, audience.ttl);
			}
			/* Schedule in reverse order */
			const now = nowInSeconds();
			await storage.revoke(audience.name, '1', now, audience.ttl);
			await storage.revoke(audience.name, '2', now, audience.ttl);
			await storage.revoke(audience.name, '3', now, audience.ttl);
			await sleep(1000); // <-- all 3 users remains 1 sec
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await expect(
				storage.has({
					audience: audience.name,
					subject: '2',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await expect(
				storage.has({
					audience: audience.name,
					subject: '3',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await sleep(1000); // <-- all 3 users are removed
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			await expect(
				storage.has({
					audience: audience.name,
					subject: '2',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			await expect(
				storage.has({
					audience: audience.name,
					subject: '3',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			/* Now GC does not work, restart it by purging 2 user */
			await storage.purge(audience.name, '1', audience.ttl);
			await sleep(1000); // <-- 1 sec remains for purge
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.true;
			await sleep(1000); // <-- purge is gone
			await expect(
				storage.has({
					audience: audience.name,
					subject: '1',
					issued: now,
					ttl: audience.ttl
				})
			).to.eventually.be.false;
			await storage.clear(new Map([[audience.name, ['1']]]));
		});
	});
});
