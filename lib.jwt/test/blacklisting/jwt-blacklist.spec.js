import { describe, it } from 'mocha';
import bluebird from 'bluebird';
import redis from 'redis';
import { chai } from '../chai';
import { nowInSeconds } from '../../lib/utils';
import { sleep } from '../utils';
import { JWTBlacklist } from '../../lib/blacklisting/jwt-blacklist';
import { MemoryStorage } from '../../lib/blacklisting/storage/memory';
import { RedisStorage } from '../../lib/blacklisting/storage/redis';

bluebird.promisifyAll(redis);

describe('JWTBlacklist spec', () => {
	const { expect } = chai;
	const StorageDefAlrdyMsg = 'Storage defined already';
	const StorageNotDefMsg = 'Storage is not defined';
	const redisStorage = new RedisStorage({
		redis: redis.createClient(),
		clean: true
	});

	describe('init function spec', () => {
		it('throws if already initialized', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage());
			await expect(instance.init(new MemoryStorage()))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', StorageDefAlrdyMsg);
		});
	});

	describe('defineAudiences function spec', () => {
		it('throws if storage is not defined', async () => {
			await expect(new JWTBlacklist().defineAudiences([{ name: ' ', ttl: 1 }]))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', StorageNotDefMsg);
		});

		it('throws if underlying storage does not support static audience defining', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new RedisStorage({}));
			await expect(instance.defineAudiences([{ name: ' ', ttl: 1 }]))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', 'Underlying storage does not suport static audience defining');
		});

		it('defines all audiences successfully', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage());
			await expect(instance.defineAudiences([{ name: '1', ttl: 1 }, { name: '2', ttl: 2 }]))
				.to.eventually.be.fulfilled.and.to.be.array()
				.ofSize(2)
				.equalTo([true, true]);
		});

		it('defines a few audiences successfully, returns Error for unsuccessfull ones', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage());
			const bulkResult = await instance.defineAudiences([{ name: '1', ttl: 1 }, { name: '1', ttl: 1 }]);
			expect(bulkResult)
				.to.be.array()
				.ofSize(2);
			expect(bulkResult[0]).to.be.equal(true);
			expect(bulkResult[1])
				.to.be.an.instanceOf(Error)
				.and.to.have.property('message', 'Audience 1 was defined already');
		});
	});

	describe('isBlacklisted function spec', () => {
		const aud = 'user';

		it('throws if storage not initialized', async () => {
			await expect(new JWTBlacklist().isBlacklisted({ aud, sub: '0', iat: 0, exp: 0 }))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', StorageNotDefMsg);
		});

		it('throws when no TTL for operation found', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage()); // notice no @all ttl
			await expect(
				instance.isBlacklisted({
					sub: '1', // notice no explicit audience
					iat: 1,
					exp: 1
				})
			).to.eventually.be.rejectedWith(Error, 'No TTL for operation');
		});

		it('throws when jwt does not have required properties (sub & iat & exp)', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage());
			const token = { aud: 'aud' };
			await expect(instance.isBlacklisted(token)).to.eventually.be.rejectedWith(
				Error,
				'Jwt needs to contain sub property'
			);
			token.sub = 'sub';
			await expect(instance.isBlacklisted(token)).to.eventually.be.rejectedWith(
				Error,
				'Jwt needs to contain iat property'
			);
			token.iat = 1;
			await expect(instance.isBlacklisted(token)).to.eventually.be.rejectedWith(
				Error,
				'Jwt needs to contain exp property'
			);
		});

		it('throws when underlying storage uses static defined audiences and audience was not defined previously', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage());
			const token = {
				sub: '1',
				aud,
				iat: 1,
				exp: 1
			};
			await expect(instance.isBlacklisted(token))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', `Audience ${aud} was not defined`);
		});

		it('uses token TTL, when it has explicit audience on him', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 10); // notice @all 10 sec
			const now = nowInSeconds();
			const token = {
				sub: 'sub',
				aud: 'aud',
				iat: now,
				exp: now + 1
			};
			await instance.purge('sub', 'aud'); // notice no explicit TTL
			// will use token ttl, just to ensure that we are purged for now on
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.true;
			// after 1 second purge expires so we are able to use token again
			await sleep(1000);
			// now we expect false, because purge has gone
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.false;
		});

		it('uses @all TTL, when token does not have explicit audience', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 2); // notice @all 2 sec
			const now = nowInSeconds();
			const token = {
				sub: 'sub', // notice no explicit audience
				iat: now,
				exp: now + 1
			};
			await instance.purge('sub'); // notice no explicit TTL
			// ensure that we are purged for now on
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.true;
			// after 1 second token expires, we expect to false, because purge must be gone
			await sleep(1000);
			// but because @all ttl used, it is still considered blacklisted
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.true;
			// after another second, @all ttl is gone
			await sleep(1000);
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.false;
		});

		it('uses @all audience if no token aud found in the token payload', async () => {
			const blacklist = new JWTBlacklist();
			await blacklist.init(new MemoryStorage(), 1);
			const now = nowInSeconds();
			const token = {
				sub: '1',
				iat: now,
				exp: now + 1
			};
			await blacklist.revoke(token);
			await expect(blacklist.isBlacklisted(token)).to.eventually.be.true;
		});
	});

	describe('revoke function spec', () => {
		it('throws if storage not initialized', async () => {
			await expect(new JWTBlacklist().revoke({ aud: 'aud', sub: 'o', iat: 0, exp: 0 }))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', StorageNotDefMsg);
		});

		it('throws when no TTL for operation found', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage()); // notice no @all ttl provided
			const now = nowInSeconds();
			const token = {
				// notice no explicit audience provided
				sub: '1',
				iat: now,
				exp: now + 1
			};
			// notice no explicit ttl provided
			await expect(instance.revoke(token)).to.eventually.be.rejectedWith(Error, 'No TTL for operation');
		});

		it('throws when jwt does not have required properties (sub & iat & exp)', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage());
			const token = { aud: 'aud' };
			await expect(instance.revoke(token)).to.eventually.be.rejectedWith(
				Error,
				'Jwt needs to contain sub property'
			);
			token.sub = 'sub';
			await expect(instance.revoke(token)).to.eventually.be.rejectedWith(
				Error,
				'Jwt needs to contain iat property'
			);
			token.iat = 1;
			await expect(instance.revoke(token)).to.eventually.be.rejectedWith(
				Error,
				'Jwt needs to contain exp property'
			);
		});

		it('revokes tokens without audience', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage(), 2);
			const now = nowInSeconds();
			const token = {
				sub: '1',
				iat: now,
				exp: now + 2
			};
			await instance.revoke(token);
			await sleep(1000);
			/** After 1 sec token is still here */
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.true;
			await sleep(1100);
			/** Now token is gone */
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.false;
		});

		it('when underlying storage requires TTL, uses the explicit TTL when provided', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 10);
			// issue token with 2 sec validity
			const now1 = nowInSeconds();
			const token1 = {
				sub: 'sub',
				aud: 'aud',
				iat: now1,
				exp: now1 + 2
			};
			// revoke the token, specify 1 sec for clean
			await instance.revoke(token1, 1);
			// after 1 sec do another revoke for another diff token, with 1 sec clean
			await sleep(1000);
			const now2 = nowInSeconds();
			const token2 = {
				sub: 'sub',
				aud: 'aud',
				iat: now2,
				exp: now2 + 1
			};
			await instance.revoke(token2, 1);
			// try get first token, must fail, because first revoke removed this token from storage
			await expect(instance.isBlacklisted(token1)).to.eventually.be.fulfilled.and.to.be.false;
			// try get second token, must be ok
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.to.be.true;
			// after 1 sec and this one must be gone
			await sleep(1000);
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.to.be.false;
		});

		it('when underlying storage requires TTL, uses the token validity when it has audience on him', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 10);
			// issue token with 1 sec validity, notice @all ttl is 10
			const now1 = nowInSeconds();
			const token1 = {
				sub: 'sub',
				aud: 'aud',
				iat: now1,
				exp: now1 + 1
			};
			// revoke the token without specifying explicit ttl
			await instance.revoke(token1);
			// after 1 secon revoke another token
			await sleep(1000);
			const now2 = nowInSeconds();
			const token2 = {
				sub: 'sub',
				aud: 'aud',
				iat: now2,
				exp: now2 + 1
			};
			await instance.revoke(token2);
			// try get first token, must fail, because first revoke removed this token from storage
			// based on his 1 sec ttl, notice that we also have global @all ttl for 10 seconds
			await expect(instance.isBlacklisted(token1)).to.eventually.be.fulfilled.and.to.be.false;
			// try get second token, must be ok
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.to.be.true;
			// after 1 sec and this one must be gone
			await sleep(1000);
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.to.be.false;
		});

		it('when underlying storage requires TTL, uses @all validity, when no explicit TTL and audience provided', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 2);
			// issue token with 1 sec validity, notice it doesnt have audience
			const now1 = nowInSeconds();
			const token1 = {
				sub: 'sub',
				iat: now1,
				exp: now1 + 1
			};
			// revoke the token without specifying explicit ttl
			await instance.revoke(token1);
			// after 1 second revoke another token
			await sleep(1000);
			const now2 = nowInSeconds();
			const token2 = {
				sub: 'sub',
				aud: 'aud',
				iat: now2,
				exp: now2 + 1
			};
			await instance.revoke(token2);
			// try get first token, must be ok, because first revoke used @all ttl which is 2 sec
			await expect(instance.isBlacklisted(token1)).to.eventually.be.fulfilled.and.to.be.true;
			// try get second token, must be ok, it still has 1 sec, notice it's using his aud ttl
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.to.be.true;
			// after 1 sec all of them must be gone
			await sleep(1000);
			await expect(instance.isBlacklisted(token1)).to.eventually.be.fulfilled.and.to.be.false;
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.to.be.false;
		});
	});

	describe('purge function spec', () => {
		it('throws if storage not initialized', async () => {
			await expect(new JWTBlacklist().purge('0', 'aud'))
				.to.eventually.be.rejectedWith(Error)
				.and.to.have.property('message', StorageNotDefMsg);
		});

		it('throws when no ttl for operation found', async () => {
			const instance = new JWTBlacklist();
			await instance.init(instance); // notice no all TTL
			// notice no explicit TTL
			await expect(instance.purge('sub')).to.eventually.be.rejectedWith(Error, 'No TTL for operation');
		});

		it('uses explicit ttl when provided, even if it has @all ttl', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 2); // notice all TTL 2 sec
			const now1 = nowInSeconds();
			const token1 = {
				sub: 'sub',
				iat: now1,
				exp: now1 + 2 // notice it has 2 sec validity
			};
			await instance.revoke(token1); // @all ttl will be used, but we don't care now
			// after 1 second purge a token
			await sleep(1000);
			// notice this explicit ttl will force token 1 to be cleared, even if has 2 sec validity and @all is 2
			await instance.purge('sub', null, 1);
			// after 1 sec, revoke another token
			await sleep(1000);
			const now2 = nowInSeconds();
			const token2 = {
				sub: 'sub',
				iat: now2,
				exp: now2 + 2 // notice it has 2 sec validity
			};
			await instance.revoke(token2, 1); // this 1 sec explicit ttl will flush purge
			// now check for first token, must return false
			await sleep(100);
			await expect(instance.isBlacklisted(token1)).to.eventually.be.fulfilled.and.be.false;
		});

		it('uses @all ttl, when no explicit one provided', async () => {
			const instance = new JWTBlacklist();
			await instance.init(redisStorage, 1); // notice all TTL was set for 1 sec
			const now1 = nowInSeconds();
			const token1 = {
				sub: 'sub',
				iat: now1,
				exp: now1 + 2 // notice token has 2 seconds
			};
			await instance.revoke(token1); // @all ttl will be used
			// after 1 second purge a token
			await sleep(1000);
			// notice no explicit ttl is used
			await instance.purge('sub');
			// after 1 sec, revoke another token
			await sleep(1000);
			const now2 = nowInSeconds();
			const token2 = {
				sub: 'sub',
				iat: now2,
				exp: now2 + 2 // notice it has 2 sec validity too
			};
			await instance.revoke(token2, 1); // this 1 sec explicit ttl will flush purge
			// now check for first token, must return false
			await sleep(100);
			await expect(instance.isBlacklisted(token1)).to.eventually.be.fulfilled.and.be.false;
			// second must return true
			await expect(instance.isBlacklisted(token2)).to.eventually.be.fulfilled.and.be.true;
		});

		it('purges @all audience when no audience is specified', async () => {
			const instance = new JWTBlacklist();
			await instance.init(new MemoryStorage(), 2);
			const now = nowInSeconds();
			const token = {
				sub: '1',
				iat: now,
				exp: now + 2
			};
			/** Wait 1 second */
			await sleep(1000);
			await instance.purge('1');
			/** All tokens issued before are invalid */
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.true;
			await sleep(2000);
			/** Purge is outdated and removed */
			await expect(instance.isBlacklisted(token)).to.eventually.be.fulfilled.and.to.be.false;
		});
	});
});
