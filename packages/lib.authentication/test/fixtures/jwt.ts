import { Jwt, MemoryStorage } from '@marin/lib.jwt';

const defaultJwtInstance = new Jwt({
	blacklisting: true,
	secret: 'secret-for-tests',
	signVerifyOpts: {
		sign: {
			issuer: 'issuer'
		},
		verify: {
			issuer: 'issuer'
		}
	}
});

const ACCOUNT_ROLES = {
	ADMIN: 'ADMIN',
	MODERATOR: 'MODERATOR',
	USER: 'USER'
};

const rolesTtlMap = new Map<string, number>(); // seconds
rolesTtlMap.set(ACCOUNT_ROLES.ADMIN, 2);
rolesTtlMap.set(ACCOUNT_ROLES.MODERATOR, 3);
rolesTtlMap.set(ACCOUNT_ROLES.USER, 1);

(async (): Promise<void> => {
	await defaultJwtInstance.blacklist().init(new MemoryStorage(), 1);
	await defaultJwtInstance.blacklist().defineAudiences(Array.from(rolesTtlMap.entries()).map((entry) => ({ name: entry[0], ttl: entry[1] })));
})();

export { defaultJwtInstance, rolesTtlMap, ACCOUNT_ROLES };
