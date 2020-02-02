import { Jwt, RedisStorage } from '@marin/lib.jwt';
import bluebird from 'bluebird';
import redis from 'redis-mock';
import { string } from '@marin/lib.utils';

bluebird.promisifyAll(redis);

const defaultJwtInstance = new Jwt({
	blacklisting: true,
	secret: 'secret-for-rest-api-calls',
	signVerifyOpts: {
		sign: {
			issuer: 'issuer'
		},
		verify: {
			issuer: 'issuer'
		}
	}
});

const enum AccountRole {
	ADMIN = 'ADMIN',
	USER = 'USER'
}

const rolesTtlMap = new Map<string, number>(); // seconds
rolesTtlMap.set(AccountRole.ADMIN, 2);
rolesTtlMap.set(AccountRole.USER, 1);

(async (): Promise<void> => {
	await defaultJwtInstance.blacklist().init(
		new RedisStorage({
			redis: redis.createClient()
		}),
		1
	);
})();

function issueJWT(accountRole: AccountRole, accountId?: string): string {
	return defaultJwtInstance.sign(
		{
			sub: accountId || string.generateStringOfLength(5),
			aud: accountRole
		},
		{
			expiresIn: rolesTtlMap.get(accountRole) || defaultJwtInstance.blacklist().allTtl
		}
	);
}

async function addJwtToBlacklist(jwt: string): Promise<void> {
	const payload = await defaultJwtInstance.validate(jwt);
	await defaultJwtInstance.blacklist().revoke(payload, rolesTtlMap.get(payload.aud!));
}

export { defaultJwtInstance, rolesTtlMap, issueJWT, addJwtToBlacklist, AccountRole };
