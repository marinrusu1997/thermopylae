import type { AccountModel } from './types/models';

/**
 * Hook called when account was disabled. <br/>
 * > **Important!** The main purpose of this hook is to invalidate all of the active user sessions.
 *
 * @param account   User account that was disabled.
 */
type OnAccountDisabledHook<Account extends AccountModel> = (account: Account) => Promise<void>;

export { OnAccountDisabledHook };
