import { Jwt } from '@marin/lib.jwt';

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
rolesTtlMap.set(ACCOUNT_ROLES.USER, 4);

export { defaultJwtInstance, rolesTtlMap };
