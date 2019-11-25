import { describe, it } from 'mocha';
import redis from 'redis';
import bluebird from 'bluebird';
import { RedisStorage } from '../../../lib/blacklisting/storage/redis';
import { nowInSeconds } from '../../../lib/utils';
import { chai } from '../../chai';
import { sleep } from '../../utils';

bluebird.promisifyAll(redis);

describe('Redis Storage spec', () => {
	const redisClient = redis.createClient();
	const storage = new RedisStorage({
		redis: redisClient
	});
	const { expect } = chai;

	describe('prefix manipulations spec', () => {
		it('uses default prefix when no explicit prefix provided', () => {
			expect(new RedisStorage({ redis: redisClient }).keyPrefix()).to.be.equal('jwt-blist');
		});

		it('removes all whitespaces from the explicit provided prefix', () => {
			expect(
				new RedisStorage({
					redis: redisClient,
					keyPrefix: ' prefix'
				}).keyPrefix()
			).to.be.equal('prefix');
			expect(
				new RedisStorage({
					redis: redisClient,
					keyPrefix: ' prefix '
				}).keyPrefix()
			).to.be.equal('prefix');
			expect(
				new RedisStorage({
					redis: redisClient,
					keyPrefix: ' p r e f i x '
				}).keyPrefix()
			).to.be.equal('prefix');
		});
	});

	describe('has function spec', () => {
		it('throws when no ttl provided', async () => {
			const audience = 'audience';
			const subject = 'subject';
			await storage.revoke(audience, subject, nowInSeconds(), 1);
			await expect(
				storage.has({
					audience,
					subject,
					issued: 1
				})
			).to.eventually.be.rejectedWith(
				Error,
				'Redis storage requires ttl in order to distinguish between expired tokens'
			);
			await storage.clear(new Map([[audience, [subject]]]));
		});

		it('validates token for the user who was never blacklisted', async () => {
			const audience = 'audience';
			const subject = 'subject';
			const issued = nowInSeconds();
			const ttl = 2; // seconds
			expect(
				storage.has({
					audience,
					subject,
					issued,
					ttl
				})
			).to.eventually.be.equal(false);
		});

		it('validates token for the user who was blacklisted before, but was later removed', async () => {
			const audience = 'audience';
			const subject = 'subject';
			const issued = nowInSeconds();
			const ttl = 2; // seconds
			await storage.revoke(audience, subject, issued);
			await sleep(ttl * 1000); // <-- token remains 1 sec
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.false;
			await sleep(1000);
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.false;
		});
	});

	describe('revoke function spec', () => {
		it('throws in clean mode, when no ttl provided', async () => {
			const audience = 'audience';
			const subject = 'subject';
			const ttl = 1;
			const issued = nowInSeconds();
			const instance = new RedisStorage({
				redis: redisClient,
				clean: true
			});
			await instance.revoke(audience, subject, issued, ttl);
			await expect(instance.revoke(audience, subject, issued)).to.eventually.be.rejectedWith(
				Error,
				'TTL is mandatory when using Redis Storage in clean mode'
			);
			await storage.clear(new Map([[audience, [subject]]]));
		});

		it('creates new revoke array on first operation, if no previously revoke was made', async () => {
			const audience = 'audience';
			const subject = 'subject';
			let issued = nowInSeconds();
			const ttl = 2; // seconds
			await storage.purge(audience, subject);
			await sleep(1000); // <-- purge remains 1 sec
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.true;
			issued = nowInSeconds();
			await storage.revoke(audience, subject, issued);
			await sleep(1000); // <-- purge is gone, revoke remains 1 sec
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.true;
			await sleep(1000); // <-- revoke is gone
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.false;
			await storage.clear(new Map([[audience, [subject]]]));
		});

		it('removes revokeds when in clean mode', async () => {
			const audience = 'audience';
			const subject = 'subject';
			const ttl = 1; // second
			const instance = new RedisStorage({
				redis: redisClient,
				clean: true
			});
			const now = nowInSeconds();
			await instance.revoke(audience, subject, now, ttl);
			await sleep(1000);
			await instance.revoke(audience, subject, now + ttl, ttl);
			await expect(instance.has({ audience, subject, issued: now, ttl })).to.eventually.be.equal(false);
			await expect(instance.has({ audience, subject, issued: now + ttl, ttl })).to.eventually.be.equal(true);
			await sleep(1000);
			await expect(instance.has({ audience, subject, issued: now + ttl, ttl })).to.eventually.be.equal(false);
			await sleep(1000);
			await expect(instance.has({ audience, subject, issued: now + ttl, ttl })).to.eventually.be.equal(false);
			await storage.clear(new Map([[audience, [subject]]]));
		});
	});

	describe('purge function spec', () => {
		it('throws in clean mode, when no ttl provided', async () => {
			const audience = 'audience';
			const subject = 'subject';
			const ttl = 1;
			const instance = new RedisStorage({
				redis: redisClient,
				clean: true
			});
			await instance.purge(audience, subject, ttl);
			await expect(instance.purge(audience, subject)).to.eventually.be.rejectedWith(
				Error,
				'TTL is mandatory when using Redis Storage in clean mode'
			);
			await storage.clear(new Map([[audience, [subject]]]));
		});

		it('removes expired purge when in clean mode', async () => {
			const audience = 'audience';
			const subject = 'subject';
			const ttl = 1; // second
			const instance = new RedisStorage({
				redis: redis.createClient(),
				clean: true
			});
			await storage.purge(audience, subject, ttl);
			await sleep(1000); // <-- purge is expired
			const issued = nowInSeconds();
			await instance.revoke(audience, subject, issued, ttl); // will see expired purge, and will remove it
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.true;
			await sleep(1000); // revoke is expired
			await expect(storage.has({ audience, subject, issued, ttl })).to.eventually.be.false; // also clears the key
			await storage.clear(new Map([[audience, [subject]]]));
		});
	});

	describe('clear function spec', () => {
		it('throws when no tokens map provided', async () => {
			await expect(storage.clear()).to.eventually.be.rejectedWith(
				Error,
				'Redis storage needs tokens map in order to be able to reconstruct keys'
			);
		});

		it('removes all specified tokens on clear operation', async () => {
			const audience = 'audience';
			const subject1 = 'subject1';
			const subject2 = 'subject2';
			const now = nowInSeconds();
			const ttl = 1;
			await storage.revoke(audience, subject1, now);
			await storage.revoke(audience, subject2, now);
			await storage.clear(new Map([[audience, [subject1]]]));
			await expect(
				storage.has({ audience, subject: subject1, issued: now, ttl })
			).to.eventually.be.fulfilled.and.to.be.equal(false);
			await expect(
				storage.has({ audience, subject: subject2, issued: now, ttl })
			).to.eventually.be.fulfilled.and.to.be.equal(true);
			await sleep(1000);
			await expect(
				storage.has({ audience, subject: subject2, issued: now, ttl })
			).to.eventually.be.fulfilled.and.to.be.equal(false);
			await storage.clear(new Map([[audience, [subject1, subject2]]]));
		});
	});
});
