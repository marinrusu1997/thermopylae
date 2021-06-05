import type { AccountModel } from './models';
import type { ChangePasswordContext } from './contexts';

/**
 * Hook called when account was disabled. <br/>
 * > **Important!** The main purpose of this hook is to invalidate all of the active user sessions.
 *
 * @param account                   User account that was disabled.
 */
type OnAccountDisabledHook<Account extends AccountModel> = (account: Account) => Promise<void>;

/**
 * Hook called when account password has been changed. <br/>
 * > **Important!** The main purpose of this hook is to invalidate all of the active user sessions,
 * except the current one ({@link ChangePasswordContext.sessionId}), from where password change has been made.
 *
 * @param account                   User account password of which has been changed.
 * @param changePasswordContext     Context of the password change.
 */
type OnPasswordChangedHook<Account extends AccountModel> = (account: Account, changePasswordContext: ChangePasswordContext) => Promise<void>;

/**
 * Hook called when forgotten password has been changed.
 * > **Important!** The main purpose of this hook is to invalidate all of the active user sessions.
 *
 * @param account                   User account password of which has been changed.
 */
type OnForgottenPasswordChangedHook<Account extends AccountModel> = (account: Account) => Promise<void>;

export { OnAccountDisabledHook, OnPasswordChangedHook, OnForgottenPasswordChangedHook };
