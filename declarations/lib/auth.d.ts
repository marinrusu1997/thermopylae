export const enum AccountRole {
	ADMIN = 'ADMIN',
	USER = 'USER'
}

export const enum LogoutType {
	CURRENT_SESSION = 'CURRENT_SESSION',
	ALL_SESSIONS = 'ALL_SESSIONS',
	ALL_SESSIONS_EXCEPT_CURRENT = 'ALL_SESSIONS_EXCEPT_CURRENT'
}

export const enum AccountStatus {
	ENABLED = 'enabled',
	DISABLED = 'disabled'
}

export const enum MultiFactorAuthenticationStatus {
	ENABLED = 'enabled',
	DISABLED = 'disabled'
}
